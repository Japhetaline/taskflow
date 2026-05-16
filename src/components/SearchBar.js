/**
 * SearchBar — emits SEARCH_CHANGED on input (debounced).
 */
import { h, icon, mount } from "../utils/domUtils.js";
import { bus, EVENTS } from "../utils/eventBus.js";

export function mountSearchBar(container) {
  let timer;
  const input = h("input", {
    type: "search",
    class: "search-input",
    placeholder: "Search tasks…",
    "aria-label": "Search tasks",
    autocomplete: "off",
    spellcheck: "false",
    oninput: (e) => {
      clearTimeout(timer);
      const value = e.target.value;
      timer = setTimeout(() => bus.emit(EVENTS.SEARCH_CHANGED, value), 120);
    },
  });

  const wrap = h("div", { class: "search-wrap" }, [
    h("span", { class: "search-icon", "aria-hidden": "true" }, [icon("search", 18)]),
    input,
  ]);

  mount(container, wrap);

  // Keyboard shortcut: "/" focuses search
  window.addEventListener("keydown", (e) => {
    if (e.key === "/" && !["INPUT", "TEXTAREA"].includes(document.activeElement.tagName)) {
      e.preventDefault();
      input.focus();
    }
  });
}
