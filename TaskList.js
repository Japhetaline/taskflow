/**
 * TaskList — main render of filtered, grouped tasks.
 *
 * Subscribes to TASKS_CHANGED, FILTER_CHANGED, SEARCH_CHANGED and rerenders.
 */
import { h, mount } from "../utils/domUtils.js";
import * as taskService from "../services/taskService.js";
import { bus, EVENTS } from "../utils/eventBus.js";
import {
  groupByDate,
  sortTasksWithinGroup,
  formatDateLabel,
  isToday,
  isOverdue,
  startOfDay,
} from "../utils/dateUtils.js";
import { renderTaskItem } from "./TaskItem.js";
import { renderEmptyState } from "./EmptyState.js";
import { getCurrentFilter } from "./FilterBar.js";

let _container;
let _searchTerm = "";

export function mountTaskList(container) {
  _container = container;

  rerender();
  bus.on(EVENTS.TASKS_CHANGED, rerender);
  bus.on(EVENTS.FILTER_CHANGED, rerender);
  bus.on(EVENTS.SEARCH_CHANGED, (term) => {
    _searchTerm = (term || "").trim().toLowerCase();
    rerender();
  });
}

function rerender() {
  if (!_container) return;
  const all = taskService.getAll();
  const filtered = applyFilter(all, getCurrentFilter());
  const searched = applySearch(filtered, _searchTerm);

  if (searched.length === 0) {
    mount(_container, [emptyForContext(all.length)]);
    return;
  }

  const groups = groupByDate(searched);

  const nodes = groups.map(([dateKey, items]) => {
    const sorted = sortTasksWithinGroup(items);
    const label = dateKey === "no-date" ? "No date" : formatDateLabel(dateKey);
    const overdue =
      dateKey !== "no-date" &&
      new Date(`${dateKey}T00:00:00`) < startOfDay(new Date()) &&
      sorted.some((t) => !t.completed);

    return h("section", { class: "task-group" }, [
      h("header", { class: `group-header${overdue ? " overdue" : ""}` }, [
        h("h2", { class: "group-title" }, label),
        h("span", { class: "group-meta" }, `${sorted.length} ${sorted.length === 1 ? "task" : "tasks"}`),
      ]),
      h("ul", { class: "task-list", role: "list" }, sorted.map(renderTaskItem)),
    ]);
  });

  mount(_container, nodes);
}

function applyFilter(tasks, filter) {
  const today = startOfDay(new Date());
  switch (filter) {
    case "today":
      return tasks.filter((t) =>
        !t.completed && t.dueDate && isToday(new Date(`${t.dueDate}T00:00:00`))
      );
    case "upcoming":
      return tasks.filter(
        (t) =>
          !t.completed &&
          t.dueDate &&
          new Date(`${t.dueDate}T00:00:00`) > today
      );
    case "overdue":
      return tasks.filter((t) => isOverdue(t));
    case "completed":
      return tasks.filter((t) => t.completed);
    case "all":
    default:
      return tasks.filter((t) => !t.completed);
  }
}

function applySearch(tasks, term) {
  if (!term) return tasks;
  return tasks.filter(
    (t) =>
      t.title.toLowerCase().includes(term) ||
      (t.description && t.description.toLowerCase().includes(term))
  );
}

function emptyForContext(totalCount) {
  if (totalCount === 0) {
    return renderEmptyState({
      title: "A clean slate.",
      text: "Capture your first task — your future self will thank you.",
    });
  }
  if (_searchTerm) {
    return renderEmptyState({
      title: "Nothing matches.",
      text: `No tasks found for “${_searchTerm}”.`,
    });
  }
  const filter = getCurrentFilter();
  const messages = {
    today: { title: "Today is yours.", text: "Nothing due today — enjoy the breathing room." },
    upcoming: { title: "Wide open ahead.", text: "No upcoming tasks scheduled." },
    overdue: { title: "All caught up.", text: "Nothing is overdue. Nice work." },
    completed: { title: "Onward.", text: "No completed tasks yet — go finish something." },
    all: { title: "Inbox zero.", text: "Every task is done. Add another to keep the flow." },
  };
  const msg = messages[filter] || messages.all;
  return renderEmptyState(msg);
}
