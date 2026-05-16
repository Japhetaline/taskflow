/**
 * NotificationService — local + push reminders.
 *
 * v1 capability:
 *  - Request permission lazily (only when the user enables reminders).
 *  - Schedule in-page reminders using setTimeout for tasks due in this session.
 *  - Show a notification via the service worker when due.
 *
 * Push (server-triggered) requires a backend with VAPID keys; the subscription
 * plumbing is stubbed so it can be wired up later without changing callers.
 */

import { combineDateTime } from "../utils/dateUtils.js";

let permission = (typeof Notification !== "undefined" && Notification.permission) || "default";
const scheduled = new Map(); // taskId -> timeoutId

export function getPermission() {
  return permission;
}

export async function requestPermission() {
  if (typeof Notification === "undefined") return "unsupported";
  if (permission === "granted" || permission === "denied") return permission;
  permission = await Notification.requestPermission();
  return permission;
}

/** Schedule an in-page reminder for a task with a future due time. */
export function scheduleReminder(task) {
  if (!task || !task.dueDate) return;
  if (permission !== "granted") return;

  cancelReminder(task.id);
  const dueAt = combineDateTime(task.dueDate, task.dueTime || "09:00").getTime();
  const delay = dueAt - Date.now();
  if (delay <= 0 || delay > 2147483647) return; // setTimeout max is ~24.8 days

  const timer = setTimeout(() => fire(task), delay);
  scheduled.set(task.id, timer);
}

export function cancelReminder(id) {
  const t = scheduled.get(id);
  if (t) {
    clearTimeout(t);
    scheduled.delete(id);
  }
}

export async function fire(task) {
  if (permission !== "granted") return;
  const reg = await navigator.serviceWorker?.getRegistration();
  const options = {
    body: task.description || "Task due now.",
    icon: "assets/icons/icon-192.png",
    badge: "assets/icons/icon-192.png",
    tag: `task-${task.id}`,
    renotify: true,
    data: { taskId: task.id },
  };
  if (reg && "showNotification" in reg) {
    reg.showNotification(task.title || "Task reminder", options);
  } else if (typeof Notification !== "undefined") {
    new Notification(task.title || "Task reminder", options);
  }
}

/* ---------- PUSH (stubbed) ---------- */

/**
 * Subscribe to push. Requires a VAPID public key from the backend.
 * Returns the PushSubscription, which the backend should persist.
 */
export async function subscribeToPush(vapidPublicKey) {
  const reg = await navigator.serviceWorker?.ready;
  if (!reg || !("pushManager" in reg)) throw new Error("Push not supported");

  const existing = await reg.pushManager.getSubscription();
  if (existing) return existing;

  return reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
  });
}

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; ++i) out[i] = raw.charCodeAt(i);
  return out;
}
