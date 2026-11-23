import "./release.js";

function askWorker(worker, message) {
  if (!worker) return Promise.resolve(null);
  return new Promise((resolve) => {
    const channel = new MessageChannel();
    const timeout = window.setTimeout(() => {
      channel.port1.close();
      resolve(null);
    }, 5000);
    channel.port1.onmessage = (event) => {
      window.clearTimeout(timeout);
      channel.port1.close();
      resolve(event.data);
    };
    worker.postMessage(message, [channel.port2]);
  });
}

export async function setupUpdates(canReload) {
  const workers = navigator.serviceWorker;
  if (!workers) return;

  const current = globalThis.PAPA_RELEASE.version;
  const banner = document.getElementById("update-banner");
  const message = document.getElementById("update-message");
  const update = document.getElementById("update-now");
  const later = document.getElementById("update-later");
  let available;
  let dismissed;
  let applying = false;

  async function checkRelease() {
    const controller = workers.controller;
    const status = await askWorker(controller, { type: "CHECK_RELEASE" });
    if (!status || controller !== workers.controller || applying) return;
    available = status.latest === current ? undefined : status.latest;
    banner.hidden = !available || dismissed === available;
    if (!banner.hidden) message.textContent = "È disponibile un aggiornamento.";
  }

  later.addEventListener("click", () => {
    dismissed = available;
    banner.hidden = true;
    document.getElementById("nav-today").focus({ preventScroll: true });
  });

  update.addEventListener("click", async () => {
    if (!available || applying) return;
    if (!canReload()) {
      message.textContent = "Attendi il salvataggio, poi tocca Aggiorna.";
      return;
    }
    applying = true;
    update.disabled = true;
    later.disabled = true;
    message.textContent = "Aggiornamento in corso…";
    try {
      const status = await askWorker(workers.controller, { type: "USE_RELEASE", wanted: available });
      if (status?.selected === available && canReload()) {
        window.location.reload();
        return;
      }
      message.textContent = status?.selected === available
        ? "Attendi il salvataggio, poi tocca Aggiorna."
        : "Aggiornamento in attesa. Riprova tra poco.";
    } catch {
      message.textContent = "Aggiornamento in attesa. Riprova tra poco.";
    }
    applying = false;
    update.disabled = false;
    later.disabled = false;
  });

  try {
    workers.addEventListener("controllerchange", checkRelease);
    const registration = await workers.register("./sw.js", { updateViaCache: "none" });
    await checkRelease();

    const checkOnline = async () => {
      if (document.visibilityState !== "visible") return;
      await checkRelease();
      try {
        await registration.update();
      } catch {
        // The selected release remains available offline.
      }
    };
    document.addEventListener("visibilitychange", checkOnline);
    window.addEventListener("online", checkOnline);
    window.addEventListener("pageshow", checkOnline);
    window.setInterval(checkOnline, 15 * 60 * 1000);
    await checkOnline();
  } catch (error) {
    console.warn("Impossibile avviare gli aggiornamenti dell’app.", error);
  }
}
