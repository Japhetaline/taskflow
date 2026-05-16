/**
 * SettingsDrawer — slide-in right drawer with two controls:
 *   • Morning briefing toggle
 *   • Briefing time (visible only when the toggle is on)
 *
 * Dismissed by clicking the overlay, the close button, or pressing Escape.
 */

import { h, icon } from "../utils/domUtils.js";
import * as briefingService from "../services/briefingService.js";
import * as notificationService from "../services/notificationService.js";
import { toast } from "../utils/toast.js";

let drawerEl = null;
let previouslyFocused = null;

export function openSettings() {
  if (drawerEl) return;
  const root = document.getElementById("modal-root");
  if (!root) return;

  previouslyFocused = document.activeElement;
  drawerEl = render();
  root.appendChild(drawerEl);
  document.addEventListener("keydown", onEscape);
  // Focus the first interactive control for keyboard users
  requestAnimationFrame(() =>
    drawerEl?.querySelector("input, button")?.focus()
  );
}

export function closeSettings() {
  if (!drawerEl) return;
  document.removeEventListener("keydown", onEscape);
  drawerEl.remove();
  drawerEl = null;
  previouslyFocused?.focus?.();
}

function onEscape(e) {
  if (e.key === "Escape") {
    e.preventDefault();
    closeSettings();
  }
}

function render() {
  const overlay = h("div", {
    class: "drawer-overlay",
    onclick: (e) => { if (e.target === overlay) closeSettings(); },
  });

  const briefingEnabled = briefingService.isEnabled();

  const timeInput = h("input", {
    type: "time",
    id: "briefing-time",
    value: briefingService.getTime(),
    onchange: (e) => briefingService.setTime(e.target.value),
  });

  const timeRow = h("div", { class: "settings-row settings-row-sub" }, [
    h("label", { for: "briefing-time" }, "Briefing time"),
    timeInput,
  ]);
  timeRow.hidden = !briefingEnabled;

  const toggleInput = h("input", {
    type: "checkbox",
    id: "briefing-toggle",
    checked: briefingEnabled,
    onchange: async (e) => {
      const want = e.target.checked;
      if (want && notificationService.getPermission() !== "granted") {
        const perm = await notificationService.requestPermission();
        if (perm !== "granted") {
          e.target.checked = false;
          toast({ message: "Enable notifications to receive your briefing" });
          return;
        }
      }
      briefingService.setEnabled(want);
      timeRow.hidden = !want;
    },
  });

  const drawer = h("aside", {
    class: "drawer",
    role: "dialog",
    "aria-modal": "true",
    "aria-label": "Settings",
  }, [
    h("header", { class: "drawer-header" }, [
      h("h2", { class: "drawer-title" }, "Settings"),
      h("button", {
        class: "icon-btn",
        type: "button",
        "aria-label": "Close settings",
        onclick: closeSettings,
      }, [icon("close", 18)]),
    ]),
    h("div", { class: "drawer-body" }, [
      h("section", { class: "settings-section" }, [
        h("div", { class: "settings-row" }, [
          h("div", { class: "settings-row-label" }, [
            h("strong", {}, "Morning briefing"),
            h("span", {}, "A daily nudge with today's tasks."),
          ]),
          h("label", { class: "switch", "aria-label": "Toggle morning briefing" }, [
            toggleInput,
            h("span", { class: "switch-slider", "aria-hidden": "true" }),
          ]),
        ]),
        timeRow,
      ]),
    ]),
  ]);

  overlay.appendChild(drawer);
  return overlay;
}
