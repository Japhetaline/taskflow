/**
 * TaskItem — single task row. Pure render function returning a DOM node.
 */
import { h, icon } from "../utils/domUtils.js";
import * as taskService from "../services/taskService.js";
import { CATEGORIES, RECURRENCES } from "../services/taskService.js";
import { formatTime, isOverdue } from "../utils/dateUtils.js";
import { openTaskForm } from "./taskFormHost.js";
import { toast } from "../utils/toast.js";

export function renderTaskItem(task) {
  const overdue = isOverdue(task);

  const checkbox = h("button", {
    type: "button",
    class: "task-checkbox",
    role: "checkbox",
    "aria-checked": task.completed ? "true" : "false",
    "aria-label": task.completed ? "Mark as not done" : "Mark as done",
    onclick: () => taskService.toggleComplete(task.id),
  });

  const editBtn = h("button", {
    type: "button",
    class: "task-action",
    "aria-label": "Edit task",
    title: "Edit",
    onclick: () => openTaskForm(task),
  }, [icon("edit", 16)]);

  const deleteBtn = h("button", {
    type: "button",
    class: "task-action is-danger",
    "aria-label": "Delete task",
    title: "Delete",
    onclick: async () => {
      const removed = await taskService.remove(task.id);
      if (removed) {
        toast({
          message: "Task deleted",
          actionLabel: "Undo",
          onAction: () => taskService.create({
            title: removed.title,
            description: removed.description,
            dueDate: removed.dueDate,
            dueTime: removed.dueTime,
            category: removed.category,
            priority: removed.priority,
          }),
        });
      }
    },
  }, [icon("trash", 16)]);

  const meta = [];
  if (overdue) meta.push(h("span", { class: "tag tag-overdue" }, "Overdue"));
  if (task.dueTime) meta.push(h("span", { class: "tag tag-time" }, formatTime(task.dueTime)));
  if (task.category && task.category !== "other") {
    const cat = CATEGORIES[task.category];
    meta.push(h("span", {
      class: "tag",
      style: { ["--cat-color"]: cat.color },
    }, cat.label));
  }
  if (task.priority === "high") {
    meta.push(h("span", { class: "tag tag-priority-high" }, "High"));
  }
  if (task.recurrence && RECURRENCES[task.recurrence]) {
    meta.push(h("span", {
      class: "tag tag-recurring",
      title: `Repeats ${RECURRENCES[task.recurrence].label.toLowerCase()}`,
    }, [icon("recurring", 12), RECURRENCES[task.recurrence].label]));
  }

  const body = h("div", { class: "task-body" }, [
    h("div", { class: "task-title" }, task.title),
    task.description ? h("div", { class: "task-desc" }, task.description) : null,
    meta.length ? h("div", { class: "task-meta" }, meta) : null,
  ]);

  return h("li", {
    class: `task-item${task.completed ? " is-done" : ""}`,
    dataset: { id: task.id },
  }, [
    checkbox,
    body,
    h("div", { class: "task-actions" }, [editBtn, deleteBtn]),
  ]);
}
