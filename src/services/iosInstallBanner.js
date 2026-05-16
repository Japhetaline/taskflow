/**
 * iOS install guidance banner.
 *
 * iOS Safari/Chrome never fire beforeinstallprompt — the OS doesn't expose
 * a programmatic install API. Only the user can add the app to the Home
 * Screen, via Safari's share sheet. So we surface a dismissible banner
 * with a "Show me how" action that opens step-by-step instructions.
 *
 * Guards:
 *  - Only runs on iOS (iPhone/iPad/iPod, including iPadOS desktop-mode)
 *  - Skips if already installed (standalone display mode)
 *  - Skips if the user previously dismissed (localStorage)
 */

import { h } from "../utils/domUtils.js";

const DISMISS_KEY = "taskflow:ios-install-dismissed";

let bannerEl = null;
let howtoEl = null;

export function init() {
  if (!shouldShow()) return;
  // Defer so the app renders before the banner appears
  setTimeout(showBanner, 1400);
}

function shouldShow() {
  return isIOS() && !isStandalone() && !wasDismissed();
}

function isIOS() {
  return (
    /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    // iPadOS 13+ reports platform as MacIntel but has touch
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true
  );
}

function wasDismissed() {
  try { return localStorage.getItem(DISMISS_KEY) === "1"; } catch { return false; }
}

function markDismissed() {
  try { localStorage.setItem(DISMISS_KEY, "1"); } catch {}
}

/* ---------- Banner ---------- */

function showBanner() {
  if (bannerEl) return;
  const root = document.getElementById("install-root");
  if (!root) return;

  bannerEl = h("div", {
    class: "ios-install-banner",
    role: "dialog",
    "aria-label": "Add TaskFlow to your Home Screen",
  }, [
    h("div", { class: "ios-install-body" }, [
      h("div", { class: "ios-install-icon", "aria-hidden": "true" }, shareSVG(24)),
      h("div", { class: "ios-install-text" }, [
        h("strong", {}, "Add to Home Screen"),
        h("span", {}, "Install TaskFlow for instant, offline access."),
      ]),
    ]),
    h("div", { class: "ios-install-actions" }, [
      h("button", {
        class: "btn btn-ghost",
        type: "button",
        onclick: () => { markDismissed(); hideBanner(); },
      }, "Not now"),
      h("button", {
        class: "btn btn-primary",
        type: "button",
        onclick: showHowTo,
      }, "Show me how"),
    ]),
  ]);

  root.appendChild(bannerEl);
}

function hideBanner() {
  if (!bannerEl) return;
  bannerEl.classList.add("is-out");
  setTimeout(() => { bannerEl?.remove(); bannerEl = null; }, 220);
}

/* ---------- How-to modal ---------- */

function showHowTo() {
  if (howtoEl) return;
  const root = document.getElementById("modal-root");
  if (!root) return;

  const overlay = h("div", {
    class: "modal-overlay",
    onclick: (e) => { if (e.target === overlay) closeHowTo(); },
  }, [
    h("div", {
      class: "modal ios-howto",
      role: "dialog",
      "aria-modal": "true",
      "aria-label": "How to install TaskFlow",
    }, [
      h("div", { class: "modal-header" }, [
        h("h2", { class: "modal-title" }, "Install TaskFlow"),
        h("button", {
          class: "icon-btn",
          type: "button",
          "aria-label": "Close",
          onclick: closeHowTo,
        }, closeSVG(18)),
      ]),
      h("div", { class: "modal-body" }, [
        h("p", { class: "ios-howto-lead" },
          "iOS doesn't let apps install themselves — but you can add TaskFlow to your Home Screen in three quick taps:"),
        h("ol", { class: "ios-howto-steps" }, [
          step(1, ["Tap the ", shareSVG(14), " ", h("strong", {}, "Share"), " button"], "in Safari's bottom toolbar"),
          step(2, ["Tap ", h("strong", {}, "“Add to Home Screen”")], "Scroll the share sheet if you don't see it"),
          step(3, ["Tap ", h("strong", {}, "“Add”"), " in the top corner"], "TaskFlow appears on your Home Screen"),
        ]),
      ]),
      h("div", { class: "modal-footer" }, [
        h("button", {
          class: "btn btn-primary",
          type: "button",
          onclick: closeHowTo,
        }, "Got it"),
      ]),
    ]),
  ]);

  howtoEl = overlay;
  root.appendChild(overlay);
  document.addEventListener("keydown", onEscape);
}

function closeHowTo() {
  if (!howtoEl) return;
  howtoEl.remove();
  howtoEl = null;
  document.removeEventListener("keydown", onEscape);
}

function onEscape(e) {
  if (e.key === "Escape") closeHowTo();
}

function step(num, lead, sub) {
  return h("li", { class: "ios-howto-step" }, [
    h("span", { class: "ios-howto-num", "aria-hidden": "true" }, String(num)),
    h("div", { class: "ios-howto-step-text" }, [
      h("div", { class: "ios-howto-step-lead" }, lead),
      h("div", { class: "ios-howto-step-sub" }, sub),
    ]),
  ]);
}

/* ---------- inline SVG helpers ---------- */

function makeSVG(size, paths) {
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("width", size);
  svg.setAttribute("height", size);
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "1.8");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  svg.setAttribute("aria-hidden", "true");
  for (const d of paths) {
    const p = document.createElementNS(ns, "path");
    p.setAttribute("d", d);
    svg.appendChild(p);
  }
  return svg;
}

// iOS-style share icon: rectangle with upward arrow
function shareSVG(size) {
  const svg = makeSVG(size, [
    "M8 6H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-2",
    "M12 3v13",
    "M9 6l3-3 3 3",
  ]);
  if (size <= 16) {
    svg.style.verticalAlign = "text-bottom";
    svg.style.display = "inline";
    svg.style.margin = "0 2px";
  }
  return svg;
}

function closeSVG(size = 16) {
  return makeSVG(size, ["M18 6 6 18", "M6 6l12 12"]);
}
