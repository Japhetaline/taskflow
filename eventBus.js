/**
 * Tiny pub/sub event bus.
 * Components subscribe to changes without depending on each other.
 *
 * @example
 * import { bus, EVENTS } from "../utils/eventBus.js";
 * const off = bus.on(EVENTS.TASKS_CHANGED, () => render());
 * bus.emit(EVENTS.TASKS_CHANGED);
 * off(); // unsubscribe
 */

export const EVENTS = Object.freeze({
  TASKS_CHANGED: "tasks:changed",
  FILTER_CHANGED: "filter:changed",
  SEARCH_CHANGED: "search:changed",
  THEME_CHANGED: "theme:changed",
  TOAST: "toast",
  TASK_FORM_CLOSE: "taskform:close",
  ONLINE_CHANGED: "online:changed",
});

class EventBus {
  constructor() {
    /** @type {Map<string, Set<Function>>} */
    this._handlers = new Map();
  }

  on(event, handler) {
    if (!this._handlers.has(event)) this._handlers.set(event, new Set());
    this._handlers.get(event).add(handler);
    return () => this.off(event, handler);
  }

  off(event, handler) {
    const set = this._handlers.get(event);
    if (set) set.delete(handler);
  }

  emit(event, payload) {
    const set = this._handlers.get(event);
    if (!set) return;
    set.forEach((handler) => {
      try {
        handler(payload);
      } catch (err) {
        console.error(`[bus] handler error for "${event}":`, err);
      }
    });
  }
}

export const bus = new EventBus();
