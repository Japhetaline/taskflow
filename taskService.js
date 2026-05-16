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
  return update(id, { completed: !existing.completed });
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
  };
}

function uuid() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  // Fallback
  return "task_" + Math.random().toString(36).slice(2, 11) + "_" + Date.now().toString(36);
}
