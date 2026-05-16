/**
 * Toast notifications.
 * Supports optional action button (e.g., "Undo").
 */
import { h, mount } from "./domUtils.js";

const DEFAULT_DURATION = 4000;
let counter = 0;

/**
 * Show a toast.
 * @param {object} options
 * @param {string} options.message
 * @param {string} [options.actionLabel] - Optional action button label.
 * @param {Function} [options.onAction] - Called when action is clicked.
 * @param {number} [options.duration] - Auto-dismiss after ms. 0 disables.
 */
export function toast({ message, actionLabel, onAction, duration = DEFAULT_DURATION }) {
  const root = document.getElementById("toast-root");
  if (!root) return;

  const id = `toast-${++counter}`;
  const el = h("div", { class: "toast", id, role: "status" }, [
    h("span", {}, message),
    actionLabel
      ? h(
          "button",
          {
            type: "button",
            onclick: () => {
              try {
                onAction?.();
              } finally {
                dismiss(el);
              }
            },
          },
          actionLabel
        )
      : null,
  ]);

  root.appendChild(el);

  let timer;
  if (duration > 0) {
    timer = setTimeout(() => dismiss(el), duration);
  }

  function dismiss(node) {
    if (timer) clearTimeout(timer);
    node.classList.add("is-out");
    node.addEventListener("animationend", () => node.remove(), { once: true });
  }

  return () => dismiss(el);
}
