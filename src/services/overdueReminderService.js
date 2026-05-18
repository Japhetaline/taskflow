/**
 * OverdueReminderService — periodic nag while tasks remain overdue.
 *
 * Fires a local notification summarising overdue tasks. Rate-limited so the
 * user is not spammed: at most one notification per RATE_LIMIT_MS, persisted
 * in localStorage so the limit survives reloads.
 *
 * Triggers:
 *  - On app boot (after a small delay so we don't fire before the first paint)
 *  - On window focus (catches "user came back hours later" case)
 *  - Every CHECK_INTERVAL_MS while the app is open
 *  - Whenever the task set changes (a fresh task may have just gone overdue)
 *
 * Like reminders/briefings, setTimeout-based delivery only works while the
 * app is alive. Background delivery would need a server-side push at a
 * scheduled cadence — see the integration note in briefingService.js.
 */

import * as taskService from "./taskService.js";
import * as notificationService from "./notificationService.js";
import { isOverdue } from "../utils/dateUtils.js";
import { bus, EVENTS } from "../utils/eventBus.js";

const CHECK_INTERVAL_MS = 60 * 60 * 1000; // hourly while open
const RATE_LIMIT_MS = 60 * 60 * 1000;     // at most once per hour
const LAST_FIRE_KEY = "taskflow:overdue-last-fire";
const BOOT_DELAY_MS = 5000;

let timer = null;

export function init() {
  setTimeout(check, BOOT_DELAY_MS);
  timer = setInterval(check, CHECK_INTERVAL_MS);
  window.addEventListener("focus", check);
  // Re-check on every task mutation. The rate-limit guards against bursts
  // (e.g., bulk imports) firing multiple notifications back-to-back.
  bus.on(EVENTS.TASKS_CHANGED, check);
}

function check() {
  if (notificationService.getPermission() !== "granted") return;

  const overdue = taskService.getAll().filter((t) => isOverdue(t));
  if (overdue.length === 0) return;

  const last = Number(localStorage.getItem(LAST_FIRE_KEY) || 0);
  if (Date.now() - last < RATE_LIMIT_MS) return;

  fire(overdue.length);
  try { localStorage.setItem(LAST_FIRE_KEY, String(Date.now())); } catch {}
}

async function fire(count) {
  const reg = await navigator.serviceWorker?.getRegistration();
  const title = count === 1 ? "1 task is overdue" : `${count} tasks are overdue`;
  const body = count === 1
    ? "Don't let it slip — open TaskFlow and knock it out."
    : "Don't let them pile up — open TaskFlow to catch up.";
  const options = {
    body,
    icon: "assets/icons/icon-192.png",
    badge: "assets/icons/icon-192.png",
    tag: "overdue-reminder",
    renotify: true,
  };
  if (reg && "showNotification" in reg) {
    reg.showNotification(title, options);
  } else if (typeof Notification !== "undefined" && Notification.permission === "granted") {
    new Notification(title, options);
  }
}
