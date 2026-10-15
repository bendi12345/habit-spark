export interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

let deferredPrompt: InstallPromptEvent | null = null;

export function captureInstallPrompt(event: Event) {
  event.preventDefault();
  deferredPrompt = event as InstallPromptEvent;
  window.dispatchEvent(new Event("pwa-install-available"));
}

export function getInstallPrompt() {
  return deferredPrompt;
}

export function clearInstallPrompt() {
  deferredPrompt = null;
}
