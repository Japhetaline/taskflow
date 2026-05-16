/**
 * SyncService — drains the local sync queue when the device is online.
 *
 * In v1 there is no backend, so this is a no-op drainer: it logs what would be
 * sent and clears the queue once "delivered". When a real API exists, replace
 * the `deliver()` function with the actual fetch calls.
 *
 * Also registers a Background Sync tag so the service worker can retry on
 * behalf of the page (Chromium-only API, gracefully ignored elsewhere).
 */

import * as db from "../storage/db.js";
import { bus, EVENTS } from "../utils/eventBus.js";

const SYNC_TAG = "taskflow-sync-tasks";
let draining = false;

export function init() {
  // Online/offline broadcasts
  window.addEventListener("online", () => {
    bus.emit(EVENTS.ONLINE_CHANGED, true);
    drain();
  });
  window.addEventListener("offline", () => {
    bus.emit(EVENTS.ONLINE_CHANGED, false);
  });
  bus.emit(EVENTS.ONLINE_CHANGED, navigator.onLine);

  // Try to drain on boot if we are online
  if (navigator.onLine) drain();

  // Drain whenever local mutations land while online
  bus.on(EVENTS.TASKS_CHANGED, () => {
    if (navigator.onLine) drain();
  });

  // Drain when the service worker forwards a background-sync trigger
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.addEventListener("message", (event) => {
      if (event.data?.type === "sync:drain") drain();
    });
  }
}

export async function requestBackgroundSync() {
  try {
    const reg = await navigator.serviceWorker?.ready;
    if (reg && "sync" in reg) {
      await reg.sync.register(SYNC_TAG);
    }
  } catch (err) {
    // Background Sync not supported — fine, we still drain on `online` event.
  }
}

export async function drain() {
  if (draining) return;
  draining = true;
  try {
    const pending = await db.getPendingSync();
    for (const entry of pending) {
      const ok = await deliver(entry);
      if (ok) await db.dequeueSync(entry.id);
      else break; // stop on first failure; retry next time
    }
  } finally {
    draining = false;
  }
}

/**
 * Replace this with real API calls once a backend is wired up.
 * Returning `true` removes the entry from the queue.
 */
async function deliver(entry) {
  // Example shape for future implementation:
  //
  // const url = `/api/tasks${entry.op === "delete" ? `/${entry.taskId}` : ""}`;
  // const method = { create: "POST", update: "PUT", delete: "DELETE" }[entry.op];
  // const body = entry.op === "delete" ? undefined :
  //   JSON.stringify(await db.getTask(entry.taskId));
  // const res = await fetch(url, { method, body, headers: { "Content-Type": "application/json" } });
  // return res.ok;

  if (isDev()) console.debug("[sync] would deliver:", entry);
  return true;
}

function isDev() {
  if (typeof location === "undefined") return false;
  return ["localhost", "127.0.0.1", "0.0.0.0"].includes(location.hostname);
}
