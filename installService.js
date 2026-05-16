/**
 * InstallService — manages the PWA install prompt lifecycle.
 *
 * Flow:
 *  1) Browser fires `beforeinstallprompt` when eligible.
 *  2) We stash the event and notify the UI it can show an install banner.
 *  3) When the user taps Install, we trigger the saved prompt.
 *  4) After install (or dismissal), we clear state and update the UI.
 */

import { h } from "../utils/domUtils.js";
import { toast } from "../utils/toast.js";

let deferredPrompt = null;
let bannerEl = null;
const DISMISS_KEY = "taskflow:install-dismissed";

export function init() {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e;
    if (!wasDismissed() && !isStandalone()) {
      showBanner();
    }
  });

  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    hideBanner();
    toast({ message: "TaskFlow installed. Find it on your home screen." });
  });
}

export function canInstall() {
  return Boolean(deferredPrompt);
}

export async function promptInstall() {
  if (!deferredPrompt) return { outcome: "unavailable" };
  deferredPrompt.prompt();
  const choice = await deferredPrompt.userChoice;
  deferredPrompt = null;
  hideBanner();
  return choice;
}

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // iOS Safari
    window.navigator.standalone === true
  );
}

function wasDismissed() {
  try { return localStorage.getItem(DISMISS_KEY) === "1"; } catch { return false; }
}
function markDismissed() {
  try { localStorage.setItem(DISMISS_KEY, "1"); } catch {}
}

function showBanner() {
  if (bannerEl) return;
  const root = document.getElementById("install-root");
  if (!root) return;

  bannerEl = h("div", { class: "install-banner", role: "dialog", "aria-label": "Install TaskFlow" }, [
    h("div", { class: "install-text" }, [
      h("strong", {}, "Install TaskFlow"),
      "Get it on your home screen for faster access.",
    ]),
    h("button", {
      class: "btn btn-ghost",
      type: "button",
      onclick: () => {
        markDismissed();
        hideBanner();
      },
    }, "Not now"),
    h("button", {
      class: "btn btn-primary",
      type: "button",
      onclick: async () => {
        await promptInstall();
      },
    }, "Install"),
  ]);
  root.appendChild(bannerEl);
}

function hideBanner() {
  if (bannerEl) {
    bannerEl.remove();
    bannerEl = null;
  }
}
