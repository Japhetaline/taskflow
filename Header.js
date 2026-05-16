/**
 * Header — brand + theme toggle.
 */
import { h, icon, mount } from "../utils/domUtils.js";
import * as themeService from "../services/themeService.js";
import { bus, EVENTS } from "../utils/eventBus.js";

export function mountHeader(container) {
  const themeBtn = h("button", {
    class: "icon-btn",
    type: "button",
    "aria-label": "Toggle theme",
    title: "Toggle theme (T)",
    onclick: () => themeService.toggle(),
  });

  function renderThemeIcon() {
    mount(themeBtn, [icon(themeService.get() === "dark" ? "sun" : "moon", 18)]);
    themeBtn.setAttribute("aria-pressed", themeService.get() === "dark" ? "true" : "false");
  }
  renderThemeIcon();
  bus.on(EVENTS.THEME_CHANGED, renderThemeIcon);

  const inner = h("div", { class: "header-inner" }, [
    h("div", { class: "brand", "aria-label": "TaskFlow" }, [
      h("span", { class: "brand-mark", "aria-hidden": "true" }),
      h("span", { class: "brand-name" }, [
        "Task",
        h("em", {}, "Flow"),
      ]),
    ]),
    h("div", { class: "header-actions" }, [themeBtn]),
  ]);

  mount(container, inner);
}
