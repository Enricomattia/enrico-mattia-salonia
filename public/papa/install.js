function waitForInstallPrompt() {
  return new Promise((resolve) => {
    const finish = () => {
      window.clearTimeout(timeout);
      window.removeEventListener("beforeinstallprompt", finish);
      resolve();
    };
    const timeout = window.setTimeout(finish, 1500);
    window.addEventListener("beforeinstallprompt", finish, { once: true });
  });
}

export function setupInstall() {
  const button = document.getElementById("install-app");
  if (window.matchMedia("(display-mode: standalone)").matches || navigator.standalone) return;

  const dialog = document.getElementById("install-dialog");
  const ready = document.getElementById("install-ready");
  const label = document.getElementById("install-label");
  button.hidden = false;

  const android = /Android/i.test(navigator.userAgent);
  const apple = /iPhone|iPad|iPod/i.test(navigator.userAgent) ||
    (/Macintosh/i.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
  document.getElementById("install-android").hidden = apple;
  document.getElementById("install-apple").hidden = android;

  function installed() {
    window.saggezzaInstallPrompt = undefined;
    button.hidden = true;
    if (dialog.open) dialog.close();
  }

  window.addEventListener("beforeinstallprompt", () => { ready.hidden = false; });
  window.addEventListener("appinstalled", installed);

  async function requestInstall() {
    if (button.disabled) return;
    button.disabled = true;
    ready.disabled = true;
    try {
      if (typeof navigator.install === "function") {
        await navigator.install();
        installed();
        return;
      }
      if (!window.saggezzaInstallPrompt && "onbeforeinstallprompt" in window &&
        navigator.userActivation?.isActive && !dialog.open) {
        label.textContent = "Preparazione…";
        await waitForInstallPrompt();
      }
      const prompt = window.saggezzaInstallPrompt;
      if (prompt && navigator.userActivation?.isActive !== false) {
        window.saggezzaInstallPrompt = undefined;
        if (dialog.open) dialog.close();
        await prompt.prompt();
        const { outcome } = await prompt.userChoice;
        if (outcome === "accepted") installed();
        return;
      }
    } catch (error) {
      if (error?.name === "AbortError") return;
    } finally {
      button.disabled = false;
      ready.disabled = false;
      label.textContent = "Scarica app";
    }
    ready.hidden = !window.saggezzaInstallPrompt;
    if (!dialog.open && !button.hidden) dialog.showModal();
  }

  button.addEventListener("click", requestInstall);
  ready.addEventListener("click", requestInstall);
}
