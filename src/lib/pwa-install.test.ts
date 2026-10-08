import { afterEach, describe, expect, it, vi } from "vitest";
import { captureInstallPrompt, clearInstallPrompt, getInstallPrompt } from "./pwa-install";

afterEach(() => {
  clearInstallPrompt();
});

describe("PWA installation prompt", () => {
  it("retains a prompt captured before Settings mounts and announces availability", () => {
    const prompt = vi.fn().mockResolvedValue(undefined);
    const event = Object.assign(new Event("beforeinstallprompt", { cancelable: true }), {
      prompt,
      userChoice: Promise.resolve({ outcome: "accepted" as const, platform: "web" }),
    });
    const available = vi.fn();
    window.addEventListener("pwa-install-available", available);

    captureInstallPrompt(event);

    expect(event.defaultPrevented).toBe(true);
    expect(getInstallPrompt()).toBe(event);
    expect(available).toHaveBeenCalledOnce();
    window.removeEventListener("pwa-install-available", available);
  });

  it("clears the deferred prompt after it has been used", () => {
    clearInstallPrompt();
    expect(getInstallPrompt()).toBeNull();
  });
});
