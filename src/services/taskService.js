/**
 * TaskService — domain logic for tasks.
 *
 * Components never talk to IndexedDB directly. They go through this service,
 * which:
 *  - Validates input
 *  - Maintains a single in-memory cache for fast renders
 *  - Emits TASKS_CHANGED on every mutation
 *  - Enqueues changes to the sync queue (future backend)
 */

import * as db from "../storage/db.js";
import { bus, EVENTS } from "../utils/eventBus.js";
import * as notificationService from "./notificationService.js";

const SYNC_OPS = Object.freeze({
  CREATE: "create",
  UPDATE: "update",
  DELETE: "delete",
});

export const CATEGORIES = Object.freeze({
  work: { id: "work", label: "Work", color: "var(--cat-work)" },
  personal: { id: "personal", label: "Personal", color: "var(--cat-personal)" },
  health: { id: "health", label: "Health", color: "var(--cat-health)" },
  learn: { id: "learn", label: "Learning", color: "var(--cat-learn)" },
  errand: { id: "errand", label: "Errand", color: "var(--cat-errand)" },
  other: { id: "other", label: "Other", color: "var(--cat-other)" },
});

export const PRIORITIES = Object.freeze({
  low: { id: "low", label: "Low" },
  normal: { id: "normal", label: "Normal" },
  high: { id: "high", label: "High" },
});

export const RECURRENCES = Object.freeze({
  daily: { id: "daily", label: "Daily" },
  weekdays: { id: "weekdays", label: "Weekdays" },
  weekly: { id: "weekly", label: "Weekly" },
  monthly: { id: "monthly", label: "Monthly" },
});

/** @type {Map<string, any>} */
const cache = new Map();
let loaded = false;

/* ---------- LIFECYCLE ---------- */

export async function init() {
  if (loaded) return;
  const all = await db.getAllTasks();
  cache.clear();
  for (const t of all) cache.set(t.id, t);
  loaded = true;
  bus.emit(EVENTS.TASKS_CHANGED, { all: getAll() });
}

/* ---------- READ ---------- */

export function getAll() {
  return Array.from(cache.values());
}

export function getById(id) {
  return cache.get(id) || null;
}

/* ---------- WRITE ---------- */

export async function create(input) {
  const task = normalize({
    id: uuid(),
    title: input.title?.trim() || "",
    description: input.description?.trim() || "",
    dueDate: input.dueDate || "",
    dueTime: input.dueTime || "",
    category: input.category || "other",
    priority: input.priority || "normal",
    recurrence: input.recurrence || null,
    recurrenceOriginId: input.recurrenceOriginId || null,
    completed: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    syncStatus: "pending",
  });

  if (!task.title) throw new Error("Title is required");

  await db.putTask(task);
  cache.set(task.id, task);
  await db.enqueueSync({ op: SYNC_OPS.CREATE, taskId: task.id });

  bus.emit(EVENTS.TASKS_CHANGED, { all: getAll(), added: task });
  return task;
}

export async function update(id, patch) {
  const existing = cache.get(id);
  if (!existing) throw new Error(`Task not found: ${id}`);

  const next = normalize({
    ...existing,
    ...patch,
    title: (patch.title ?? existing.title).trim(),
    description: (patch.description ?? existing.description).trim(),
    updatedAt: Date.now(),
    syncStatus: "pending",
  });

  if (!next.title) throw new Error("Title is required");

  await db.putTask(next);
  cache.set(next.id, next);
  await db.enqueueSync({ op: SYNC_OPS.UPDATE, taskId: next.id });

  bus.emit(EVENTS.TASKS_CHANGED, { all: getAll(), updated: next });
  return next;
}

export async function toggleComplete(id) {
  const existing = cache.get(id);
  if (!existing) return null;
  const wasCompleted = existing.completed;

  // Hand-rolled update so we control event ordering: TASK_COMPLETED must fire
  // before TASKS_CHANGED so statsService can refresh its cache before the UI
  // reads it. We also want any recurring successor created here to be in the
  // cache when TASKS_CHANGED fires, so subscribers see both tasks in one tick.
  const next = normalize({
    ...existing,
    completed: !wasCompleted,
    updatedAt: Date.now(),
    syncStatus: "pending",
  });

  await db.putTask(next);
  cache.set(next.id, next);
  await db.enqueueSync({ op: SYNC_OPS.UPDATE, taskId: next.id });

  // If a recurring task just completed, spawn the next occurrence (silent —
  // no extra TASKS_CHANGED emit; the one below covers both records).
  const justCompleted = !wasCompleted && next.completed;
  if (justCompleted && next.recurrence && next.dueDate) {
    await generateNextOccurrence(next);
  }

  if (justCompleted) bus.emit(EVENTS.TASK_COMPLETED, next);
  bus.emit(EVENTS.TASKS_CHANGED, { all: getAll(), updated: next });

  return next;
}

async function generateNextOccurrence(source) {
  const nextDue = advanceDate(source.dueDate, source.recurrence);
  if (!nextDue) return null;

  const next = normalize({
    id: uuid(),
    title: source.title,
    description: source.description,
    dueDate: nextDue,
    dueTime: source.dueTime,
    category: source.category,
    priority: source.priority,
    recurrence: source.recurrence,
    recurrenceOriginId: source.recurrenceOriginId || source.id,
    completed: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    syncStatus: "pending",
  });

  await db.putTask(next);
  cache.set(next.id, next);
  await db.enqueueSync({ op: SYNC_OPS.CREATE, taskId: next.id });

  // Re-arm the reminder timer for the new instance
  notificationService.scheduleReminder(next);
  return next;
}

function advanceDate(dateStr, recurrence) {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);

  if (recurrence === "daily") {
    date.setDate(date.getDate() + 1);
  } else if (recurrence === "weekdays") {
    do { date.setDate(date.getDate() + 1); }
    while (date.getDay() === 0 || date.getDay() === 6);
  } else if (recurrence === "weekly") {
    date.setDate(date.getDate() + 7);
  } else if (recurrence === "monthly") {
    date.setMonth(date.getMonth() + 1);
  } else {
    return "";
  }

  const yy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

export async function remove(id) {
  const existing = cache.get(id);
  if (!existing) return null;

  await db.deleteTask(id);
  cache.delete(id);
  await db.enqueueSync({ op: SYNC_OPS.DELETE, taskId: id });

  bus.emit(EVENTS.TASKS_CHANGED, { all: getAll(), removed: existing });
  return existing;
}

/* ---------- HELPERS ---------- */

function normalize(t) {
  // Coerce types defensively
  return {
    ...t,
    completed: Boolean(t.completed),
    title: String(t.title || ""),
    description: String(t.description || ""),
    dueDate: t.dueDate || "",
    dueTime: t.dueTime || "",
    category: CATEGORIES[t.category] ? t.category : "other",
    priority: PRIORITIES[t.priority] ? t.priority : "normal",
    recurrence: RECURRENCES[t.recurrence] ? t.recurrence : null,
    recurrenceOriginId: t.recurrenceOriginId || null,
  };
}

function uuid() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  // Fallback
  return "task_" + Math.random().toString(36).slice(2, 11) + "_" + Date.now().toString(36);
}
