/**
 * TaskForm — modal for creating and editing tasks.
 *
 * Loaded lazily via `taskFormHost.js`. Callers use
 *   openTaskForm(task?)  // edit if task, otherwise create
 * which dynamically imports this module, mounts it once, then opens it.
 */
import { h, icon } from "../utils/domUtils.js";
import { bus, EVENTS } from "../utils/eventBus.js";
import * as taskService from "../services/taskService.js";
import { CATEGORIES, PRIORITIES, RECURRENCES } from "../services/taskService.js";
import { todayISO } from "../utils/dateUtils.js";
import { toast } from "../utils/toast.js";
import * as notificationService from "../services/notificationService.js";

let _root;
let _modalEl = null;
let _previouslyFocused = null;

export function mountTaskForm(container) {
  _root = container;
  if (!_root) return;

  // Close on bus event (still useful for programmatic close paths)
  bus.on(EVENTS.TASK_FORM_CLOSE, close);

  // Escape closes when a modal is open. Other open paths (keyboard "N",
  // deep links, FAB, edit button) are handled in app.js / taskFormHost so
  // they work before this module is loaded.
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && _modalEl) {
      e.preventDefault();
      close();
    }
  });
}

export function open(task) {
  if (_modalEl) close();
  _previouslyFocused = document.activeElement;
  _modalEl = renderModal(task || null);
  _root.appendChild(_modalEl);
  // Focus title field
  requestAnimationFrame(() => _modalEl.querySelector("[data-autofocus]")?.focus());
  // Lock body scroll
  document.body.style.overflow = "hidden";
}

export function close() {
  if (!_modalEl) return;
  _modalEl.remove();
  _modalEl = null;
  document.body.style.overflow = "";
  _previouslyFocused?.focus?.();
}

function renderModal(task) {
  const isEdit = !!task;

  // Unique ids per modal instance — multiple mounts won't collide
  const uid = `tf-${Math.random().toString(36).slice(2, 8)}`;
  const ID = {
    title: `${uid}-title`,
    desc: `${uid}-desc`,
    date: `${uid}-date`,
    time: `${uid}-time`,
    cat: `${uid}-cat`,
    pri: `${uid}-pri`,
    rep: `${uid}-rep`,
  };

  const titleInput = h("input", {
    type: "text",
    id: ID.title,
    name: "title",
    required: true,
    maxlength: 200,
    placeholder: "What needs doing?",
    value: task?.title || "",
    "data-autofocus": "true",
  });

  const descInput = h("textarea", {
    id: ID.desc,
    name: "description",
    maxlength: 1000,
    rows: 3,
    placeholder: "Add a note (optional)",
  });
  descInput.value = task?.description || "";

  const dateInput = h("input", {
    type: "date",
    id: ID.date,
    name: "dueDate",
    value: task?.dueDate || "",
    min: "1970-01-01",
  });

  const timeInput = h("input", {
    type: "time",
    id: ID.time,
    name: "dueTime",
    value: task?.dueTime || "",
  });

  const categorySelect = h(
    "select",
    { id: ID.cat, name: "category" },
    Object.values(CATEGORIES).map((c) =>
      h("option", { value: c.id, selected: (task?.category || "other") === c.id }, c.label)
    )
  );

  const prioritySelect = h(
    "select",
    { id: ID.pri, name: "priority" },
    Object.values(PRIORITIES).map((p) =>
      h("option", { value: p.id, selected: (task?.priority || "normal") === p.id }, p.label)
    )
  );

  const recurrenceSelect = h(
    "select",
    { id: ID.rep, name: "recurrence" },
    [
      h("option", { value: "", selected: !task?.recurrence }, "None"),
      ...Object.values(RECURRENCES).map((r) =>
        h("option", { value: r.id, selected: task?.recurrence === r.id }, r.label)
      ),
    ]
  );

  const overlay = h("div", {
    class: "modal-overlay",
    onclick: (e) => {
      if (e.target === overlay) close();
    },
  });

  const onSubmit = async (e) => {
    e.preventDefault();
    const payload = {
      title: titleInput.value,
      description: descInput.value,
      dueDate: dateInput.value,
      dueTime: timeInput.value,
      category: categorySelect.value,
      priority: prioritySelect.value,
      recurrence: recurrenceSelect.value || null,
    };
    if (!payload.title.trim()) {
      titleInput.focus();
      return;
    }
    try {
      let saved;
      if (isEdit) {
        saved = await taskService.update(task.id, payload);
      } else {
        saved = await taskService.create(payload);
      }
      // Schedule reminder if applicable
      notificationService.scheduleReminder(saved);
      toast({ message: isEdit ? "Task updated" : "Task added" });
      close();
    } catch (err) {
      console.error(err);
      toast({ message: err.message || "Something went wrong" });
    }
  };

  const form = h("form", { onsubmit: onSubmit, novalidate: true }, [
    h("div", { class: "modal-body" }, [
      h("div", { class: "field" }, [
        h("label", { for: ID.title }, "Title"),
        titleInput,
      ]),
      h("div", { class: "field" }, [
        h("label", { for: ID.desc }, "Notes"),
        descInput,
      ]),
      h("div", { class: "field-grid" }, [
        h("div", { class: "field" }, [
          h("label", { for: ID.date }, "Due date"),
          dateInput,
        ]),
        h("div", { class: "field" }, [
          h("label", { for: ID.time }, "Time"),
          timeInput,
        ]),
      ]),
      h("div", { class: "field-grid" }, [
        h("div", { class: "field" }, [
          h("label", { for: ID.cat }, "Category"),
          categorySelect,
        ]),
        h("div", { class: "field" }, [
          h("label", { for: ID.pri }, "Priority"),
          prioritySelect,
        ]),
      ]),
      h("div", { class: "field" }, [
        h("label", { for: ID.rep }, "Repeat"),
        recurrenceSelect,
      ]),
      !isEdit
        ? h("div", { class: "field" }, [
            h("button", {
              type: "button",
              class: "btn btn-ghost",
              onclick: () => {
                dateInput.value = todayISO();
              },
            }, "Due today"),
          ])
        : null,
    ]),
    h("div", { class: "modal-footer" }, [
      isEdit
        ? h("button", {
            type: "button",
            class: "btn btn-danger",
            onclick: async () => {
              await taskService.remove(task.id);
              toast({ message: "Task deleted" });
              close();
            },
          }, "Delete")
        : null,
      h("button", {
        type: "button",
        class: "btn btn-ghost",
        onclick: () => close(),
      }, "Cancel"),
      h("button", { type: "submit", class: "btn btn-primary" }, isEdit ? "Save" : "Add task"),
    ]),
  ]);

  const modal = h("div", {
    class: "modal",
    role: "dialog",
    "aria-modal": "true",
    "aria-label": isEdit ? "Edit task" : "New task",
  }, [
    h("header", { class: "modal-header" }, [
      h("h2", { class: "modal-title" }, isEdit ? "Edit task" : "New task"),
      h("button", {
        type: "button",
        class: "icon-btn",
        "aria-label": "Close",
        onclick: () => close(),
      }, [icon("close", 18)]),
    ]),
    form,
  ]);

  overlay.appendChild(modal);
  return overlay;
}
