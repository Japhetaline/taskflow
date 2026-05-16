/**
 * FilterBar — renders filter chips with live counts.
 *
 * Filter ids:
 *  all | today | upcoming | overdue | completed
 */
import { h, mount } from "../utils/domUtils.js";
import { bus, EVENTS } from "../utils/eventBus.js";
import * as taskService from "../services/taskService.js";
import { isToday, isOverdue, startOfDay } from "../utils/dateUtils.js";

export const FILTERS = ["all", "today", "upcoming", "overdue", "completed"];
const LABELS = {
  all: "All",
  today: "Today",
  upcoming: "Upcoming",
  overdue: "Overdue",
  completed: "Completed",
};

let currentFilter = "all";

export function getCurrentFilter() {
  return currentFilter;
}

export function setFilter(id) {
  if (!FILTERS.includes(id)) return;
  currentFilter = id;
  bus.emit(EVENTS.FILTER_CHANGED, id);
  rerender();
}

let _container;

export function mountFilterBar(container) {
  _container = container;

  // Allow ?filter=today deep-link from manifest shortcuts
  const params = new URLSearchParams(location.search);
  const initial = params.get("filter");
  if (initial && FILTERS.includes(initial)) currentFilter = initial;

  rerender();
  bus.on(EVENTS.TASKS_CHANGED, rerender);
}

function rerender() {
  if (!_container) return;
  const tasks = taskService.getAll();
  const counts = computeCounts(tasks);

  const bar = h(
    "div",
    { class: "filter-bar", role: "tablist", "aria-label": "Filter tasks" },
    FILTERS.map((id) => h("button", {
      type: "button",
      role: "tab",
      class: "chip",
      "aria-pressed": id === currentFilter ? "true" : "false",
      onclick: () => setFilter(id),
    }, [
      LABELS[id],
      counts[id] != null ? h("span", { class: "count" }, String(counts[id])) : null,
    ]))
  );

  mount(_container, bar);
}

function computeCounts(tasks) {
  const counts = { all: 0, today: 0, upcoming: 0, overdue: 0, completed: 0 };
  for (const t of tasks) {
    if (t.completed) {
      counts.completed++;
    } else {
      // "All" reflects the default view: active tasks only.
      counts.all++;
      if (t.dueDate) {
        const due = new Date(`${t.dueDate}T00:00:00`);
        if (isToday(due)) counts.today++;
        else if (due >= startOfDay(new Date())) counts.upcoming++;
      }
    }
    if (isOverdue(t)) counts.overdue++;
  }
  return counts;
}
