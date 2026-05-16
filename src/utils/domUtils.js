/**
 * Minimal DOM helpers — keep the codebase free of repetitive DOM boilerplate
 * without pulling in a framework.
 */

/**
 * Create a DOM element with attributes and children.
 *
 * @example
 * h("button", { class: "btn", onclick: () => {} }, "Save");
 * h("ul", {}, [h("li", {}, "one"), h("li", {}, "two")]);
 */
export function h(tag, props = {}, children = []) {
  const el = document.createElement(tag);

  for (const [key, value] of Object.entries(props || {})) {
    if (value == null || value === false) continue;
    if (key === "class" || key === "className") {
      el.className = value;
    } else if (key === "style" && typeof value === "object") {
      Object.assign(el.style, value);
    } else if (key === "dataset" && typeof value === "object") {
      Object.assign(el.dataset, value);
    } else if (key.startsWith("on") && typeof value === "function") {
      el.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (key === "html") {
      el.innerHTML = value;
    } else if (typeof value === "boolean") {
      if (value) el.setAttribute(key, "");
    } else {
      el.setAttribute(key, String(value));
    }
  }

  appendChildren(el, children);
  return el;
}

function appendChildren(el, children) {
  if (children == null || children === false) return;
  if (Array.isArray(children)) {
    children.forEach((c) => appendChildren(el, c));
  } else if (children instanceof Node) {
    el.appendChild(children);
  } else {
    el.appendChild(document.createTextNode(String(children)));
  }
}

/** Clear all children of an element. */
export function clear(el) {
  while (el.firstChild) el.removeChild(el.firstChild);
}

/** Replace the contents of an element with new content. */
export function mount(el, content) {
  clear(el);
  appendChildren(el, content);
}

/** Event delegation helper. */
export function on(root, eventName, selector, handler) {
  root.addEventListener(eventName, (event) => {
    const target = event.target.closest(selector);
    if (target && root.contains(target)) handler(event, target);
  });
}

/** Tiny SVG icon factory using inline shapes — keeps assets out of network. */
export function icon(name, size = 18) {
  const svgNS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(svgNS, "svg");
  svg.setAttribute("width", size);
  svg.setAttribute("height", size);
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "1.6");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  svg.setAttribute("aria-hidden", "true");

  const paths = ICONS[name];
  if (!paths) return svg;
  paths.forEach((d) => {
    const p = document.createElementNS(svgNS, "path");
    p.setAttribute("d", d);
    svg.appendChild(p);
  });
  return svg;
}

const ICONS = {
  search: ["M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16Z", "M21 21l-4.35-4.35"],
  plus: ["M12 5v14", "M5 12h14"],
  close: ["M18 6 6 18", "M6 6l12 12"],
  edit: [
    "M12 20h9",
    "M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5Z",
  ],
  trash: ["M3 6h18", "M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2", "M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"],
  sun: [
    "M12 2v2",
    "M12 20v2",
    "M4.93 4.93l1.41 1.41",
    "M17.66 17.66l1.41 1.41",
    "M2 12h2",
    "M20 12h2",
    "M4.93 19.07l1.41-1.41",
    "M17.66 6.34l1.41-1.41",
    "M12 17a5 5 0 1 1 0-10 5 5 0 0 1 0 10Z",
  ],
  moon: ["M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z"],
  bell: [
    "M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9",
    "M13.73 21a2 2 0 0 1-3.46 0",
  ],
  clock: ["M12 22a10 10 0 1 1 0-20 10 10 0 0 1 0 20Z", "M12 6v6l4 2"],
  flag: ["M4 22V4", "M4 4h12l-2 4 2 4H4"],
  inbox: [
    "M22 12h-6l-2 3h-4l-2-3H2",
    "M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11Z",
  ],
  check: ["M20 6 9 17l-5-5"],
  recurring: [
    "M21 2v6h-6",
    "M3 12a9 9 0 0 1 15-6.7L21 8",
    "M3 22v-6h6",
    "M21 12a9 9 0 0 1-15 6.7L3 16",
  ],
  settings: [
    "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z",
    "M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h0a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v0a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z",
  ],
};
