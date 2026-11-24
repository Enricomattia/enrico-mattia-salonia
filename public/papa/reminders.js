const settingsKey = "saggezza-reminders.v1";
const api = "/api/papa/reminders";
const dailyCheck = 24 * 60 * 60 * 1000;
const messages = {
  off: "Un avviso agli orari del piano, anche ad app chiusa.",
  on: "Promemoria attivi.",
  empty: "Promemoria attivi. Aggiungi una pillola per ricevere il primo avviso.",
  blocked: "Consenti le notifiche di Saggezza nelle impostazioni del browser.",
  unsupported: "Per attivare i promemoria, apri Saggezza in Chrome su Android.",
  starting: "Attivazione dei promemoria…",
  syncing: "Aggiornamento dei promemoria…",
  pending: "Orari dei promemoria da aggiornare. Riprova con una connessione a Internet.",
  stopping: "Disattivazione in attesa. Riprova con una connessione a Internet."
};

function makeToken() {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)), (value) => value.toString(16).padStart(2, "0")).join("");
}

function getSchedule({ today, plans }) {
  const current = plans.findLastIndex(({ start }) => start <= today);
  return {
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    plans: plans.slice(Math.max(current, 0)).map(({ start, doses }) => ({
      start,
      times: [...new Set(doses.map(({ time }) => time))].sort()
    }))
  };
}

async function withTimeout(promise, delay) {
  let timeout;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timeout = setTimeout(() => reject(new Error("Reminder setup timed out")), delay);
      })
    ]);
  } finally {
    clearTimeout(timeout);
  }
}

function request(method, settings, body) {
  return fetch(api, {
    method,
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
    ...(settings && {
      headers: { Authorization: `Bearer ${settings.token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ revision: settings.revision, ...body })
    })
  });
}

async function subscribe(registration) {
  const response = await request("GET");
  if (!response.ok) throw new Error("Public key unavailable");
  const { publicKey } = await response.json();
  const applicationServerKey = Uint8Array.from(atob(publicKey.replace(/-/g, "+").replace(/_/g, "/")),
    (character) => character.charCodeAt(0));
  return withTimeout(registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey }), 45_000);
}

async function fingerprint(value) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(value)));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function setupReminders(readPlan) {
  const panel = document.getElementById("reminders");
  const status = document.getElementById("reminder-status");
  const enable = document.getElementById("reminder-enable");
  const disable = document.getElementById("reminder-disable");
  const supported = "Notification" in window && "PushManager" in window && "serviceWorker" in navigator;
  let next = Promise.resolve();
  let phase = "off";
  let busy = false;

  function readSettings() {
    return JSON.parse(localStorage.getItem(settingsKey));
  }

  function saveSettings(settings) {
    localStorage.setItem(settingsKey, JSON.stringify(settings));
  }

  function draw(settings, hasTimes) {
    panel.hidden = !hasTimes && !settings;
    const message = messages[phase];
    if (status.textContent !== message) status.textContent = message;
    enable.hidden = ["on", "empty", "starting", "syncing", "unsupported"].includes(phase);
    enable.textContent = settings ? "Riprova" : "Attiva promemoria";
    disable.hidden = !settings || phase === "stopping";
    enable.disabled = disable.disabled = busy;
  }

  async function updateRemote(method, settings, data) {
    settings.revision++;
    saveSettings(settings);
    return request(method, settings, data);
  }

  async function sync(intent) {
    const plan = readPlan();
    if (!plan) {
      panel.hidden = true;
      return;
    }
    const schedule = getSchedule(plan);
    const hasTimes = schedule.plans.some(({ times }) => times.length);
    let settings = readSettings();
    if (intent === "enable" && !settings && hasTimes && supported && Notification.permission === "granted") {
      settings = { token: makeToken(), revision: 0, enabled: true };
      saveSettings(settings);
    }
    if (intent === "disable" && settings) {
      settings.enabled = false;
      saveSettings(settings);
    }
    if (!settings) {
      phase = !supported ? "unsupported" : Notification.permission === "denied" ? "blocked" : "off";
      draw(settings, hasTimes);
      return;
    }

    if (!settings.enabled) {
      try {
        const response = await updateRemote("DELETE", settings);
        if (!response.ok) throw new Error("Unsubscribe failed");
        localStorage.removeItem(settingsKey);
        phase = "off";
        draw(null, hasTimes);
      } catch {
        phase = "stopping";
        draw(settings, hasTimes);
      }
      return;
    }
    if (!supported || Notification.permission !== "granted") {
      phase = supported ? "blocked" : "unsupported";
      draw(settings, hasTimes);
      return;
    }

    try {
      if (!settings.signature) {
        phase = "starting";
        draw(settings, hasTimes);
      }
      const registration = await withTimeout(navigator.serviceWorker.ready, 5_000);
      let subscription = await registration.pushManager.getSubscription() ?? await subscribe(registration);
      let data = { schedule, subscription: subscription.toJSON() };
      let signature = await fingerprint(data);
      if (signature !== settings.signature || Date.now() - settings.checkedAt >= dailyCheck) {
        phase = "syncing";
        draw(settings, hasTimes);
        let response = await updateRemote("PUT", settings, data);
        if (response.status === 410) {
          await subscription.unsubscribe();
          subscription = await subscribe(registration);
          data = { schedule, subscription: subscription.toJSON() };
          signature = await fingerprint(data);
          response = await updateRemote("PUT", settings, data);
        }
        if (response.status === 400) {
          phase = "unsupported";
          draw(settings, hasTimes);
          return;
        }
        if (!response.ok) throw new Error("Schedule sync failed");
        settings.signature = signature;
        settings.checkedAt = Date.now();
        saveSettings(settings);
      }
      phase = hasTimes ? "on" : "empty";
    } catch {
      phase = "pending";
    }
    draw(settings, hasTimes);
  }

  function refresh(intent) {
    const run = async () => {
      try {
        await (navigator.locks ? navigator.locks.request(settingsKey, () => sync(intent)) : sync(intent));
      } catch {
        // The ordinary plan remains usable if reminder settings or local storage are unavailable.
        status.textContent = "Impossibile aggiornare i promemoria.";
      }
    };
    next = next.then(run);
    return next;
  }

  enable.addEventListener("click", async () => {
    busy = enable.disabled = disable.disabled = true;
    try {
      if (supported && Notification.permission === "default") await Notification.requestPermission();
      await refresh(phase === "stopping" ? undefined : "enable");
    } catch {
      status.textContent = "Impossibile attivare le notifiche. Riprova.";
    } finally {
      busy = enable.disabled = disable.disabled = false;
    }
  });
  disable.addEventListener("click", async () => {
    busy = enable.disabled = disable.disabled = true;
    try {
      await refresh("disable");
    } finally {
      busy = enable.disabled = disable.disabled = false;
    }
  });
  window.addEventListener("online", () => refresh());
  window.addEventListener("storage", ({ key, oldValue, newValue }) => {
    if (key !== settingsKey) return;
    const before = JSON.parse(oldValue);
    const after = JSON.parse(newValue);
    if (before?.enabled !== after?.enabled || before?.signature !== after?.signature) refresh();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") refresh();
  });
  window.setInterval(() => {
    if (document.visibilityState === "visible" && ["pending", "stopping"].includes(phase)) refresh();
  }, 90_000);
  refresh();
  return refresh;
}
