export function setupInstall() {
  const button = document.getElementById("install-app");
  if (window.matchMedia("(display-mode: standalone)").matches || navigator.standalone) return;

  const dialog = document.getElementById("install-dialog");
  let installPrompt;
  button.hidden = false;

  const android = /Android/i.test(navigator.userAgent);
  const apple = /iPhone|iPad|iPod/i.test(navigator.userAgent) ||
    (/Macintosh/i.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
  document.getElementById("install-android").hidden = apple;
  document.getElementById("install-apple").hidden = android;

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    installPrompt = event;
  });
  window.addEventListener("appinstalled", () => {
    installPrompt = undefined;
    button.hidden = true;
    if (dialog.open) dialog.close();
  });

  button.addEventListener("click", async () => {
    if (installPrompt) {
      const prompt = installPrompt;
      installPrompt = undefined;
      button.disabled = true;
      try {
        await prompt.prompt();
        const { outcome } = await prompt.userChoice;
        if (outcome === "accepted") button.hidden = true;
        return;
      } catch {
        // Some browsers decline to open the native prompt. Show their menu steps.
      } finally {
        button.disabled = false;
      }
    }
    dialog.showModal();
  });
}
