/**
 * iOS install guidance banner.
 *
 * iOS Safari/Chrome never fire beforeinstallprompt, so we guide the user
 * manually: tap the Share button, then "Add to Home Screen".
 *
 * Guards:
 *  - Only runs on iOS (iPhone/iPad/iPod, including iPadOS desktop-mode)
 *  - Skips if already installed (standalone display mode)
 *  - Skips if the user previously dismissed (localStorage)
 */

import { h } from "../utils/domUtils.js";

const DISMISS_KEY = "taskflow:ios-install-dismissed";

let bannerEl = null;

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

function showBanner() {
  if (bannerEl) return;
  const root = document.getElementById("install-root");
  if (!root) return;

  bannerEl = h("div", {
    class: "ios-install-banner",
    role: "dialog",
    "aria-label": "Add TaskFlow to your Home Screen",
    "aria-modal": "false",
  }, [
    h("button", {
      class: "ios-install-close",
      type: "button",
      "aria-label": "Dismiss install prompt",
      onclick: () => { markDismissed(); hideBanner(); },
    }, closeSVG()),

    h("div", { class: "ios-install-body" }, [
      h("div", { class: "ios-install-icon", "aria-hidden": "true" }, shareSVG(28)),
      h("div", { class: "ios-install-text" }, [
        h("strong", {}, "Add to Home Screen"),
        h("span", {}, [
          "Tap ", shareSVG(13), " then “Add to Home Screen”",
        ]),
      ]),
    ]),
  ]);

  root.appendChild(bannerEl);
}

function hideBanner() {
  if (!bannerEl) return;
  bannerEl.classList.add("is-out");
  setTimeout(() => { bannerEl?.remove(); bannerEl = null; }, 220);
}

/* ---- inline SVG helpers ---- */

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
    svg.style.margin = "0 1px";
  }
  return svg;
}

function closeSVG() {
  return makeSVG(16, ["M18 6 6 18", "M6 6l12 12"]);
}
