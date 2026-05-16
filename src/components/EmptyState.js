/**
 * EmptyState — friendly fallback when no tasks match.
 */
import { h, icon } from "../utils/domUtils.js";

export function renderEmptyState({ title, text, action }) {
  return h("div", { class: "empty", role: "status" }, [
    h("div", { class: "empty-mark", "aria-hidden": "true" }, [icon("inbox", 22)]),
    h("div", { class: "empty-title" }, title),
    h("div", { class: "empty-text" }, text),
    action || null,
  ]);
}
