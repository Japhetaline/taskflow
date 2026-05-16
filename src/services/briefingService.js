/**
 * BriefingService — daily morning briefing notification.
 *
 * When enabled, fires a local notification each morning at the configured
 * time with a summary of today's tasks. Re-arms itself for the next day
 * after each firing, and re-schedules on app boot / window focus so a long
 * suspend doesn't miss the next slot.
 *
 * Preferences live in localStorage (cheap, synchronous reads):
 *   taskflow:briefing-enabled  "1" | "0"
 *   taskflow:briefing-time     "HH:mm" (default "08:00")
 *
 *  ===== FUTURE PUSH INTEGRATION POINT =====================================
 *  setTimeout only fires while a tab / installed PWA is alive. To deliver
 *  the briefing when the app is closed, the backend must send a Web Push
 *  (VAPID, subscribed via notificationService.subscribeToPush) at the user's
 *  configured time. The service worker's `push` handler should then call
 *  showNotification() with the same title/body assembled in buildBriefing().
 *  ========================================================================
 */

import * as notificationService from "./notificationService.js";
import * as taskService from "./taskService.js";
import { isOverdue, todayISO } from "../utils/dateUtils.js";

const ENABLED_KEY = "taskflow:briefing-enabled";
const TIME_KEY = "taskflow:briefing-time";
const DEFAULT_TIME = "08:00";
const MAX_TIMEOUT = 2147483647; // ~24.8 days; setTimeout's signed-int32 cap

let timer = null;

export function init() {
  reschedule();
  // If the device sleeps or the user switches away, the timer may drift
  // or never fire — re-arming on focus keeps us honest.
  window.addEventListener("focus", reschedule);
}

export function isEnabled() {
  return localStorage.getItem(ENABLED_KEY) === "1";
}

export function setEnabled(enabled) {
  try { localStorage.setItem(ENABLED_KEY, enabled ? "1" : "0"); } catch {}
  reschedule();
}

export function getTime() {
  return localStorage.getItem(TIME_KEY) || DEFAULT_TIME;
}

export function setTime(time) {
  if (!/^\d{2}:\d{2}$/.test(time)) return;
  try { localStorage.setItem(TIME_KEY, time); } catch {}
  reschedule();
}

export function reschedule() {
  cancel();
  if (!isEnabled()) return;
  if (notificationService.getPermission() !== "granted") return;

  const delay = msUntilNext(getTime());
  if (delay <= 0 || delay > MAX_TIMEOUT) return;
  timer = setTimeout(onFire, delay);
}

function cancel() {
  if (timer) { clearTimeout(timer); timer = null; }
}

async function onFire() {
  await fireBriefing();
  // Arm tomorrow's briefing
  reschedule();
}

/** Exposed so the settings UI can offer a "Send a test" affordance later. */
export async function fireBriefing() {
  if (notificationService.getPermission() !== "granted") return;
  const { title, body } = buildBriefing();

  const reg = await navigator.serviceWorker?.getRegistration();
  const options = {
    body,
    icon: "assets/icons/icon-192.png",
    badge: "assets/icons/icon-192.png",
    tag: "briefing",
    renotify: true,
  };
  if (reg && "showNotification" in reg) {
    reg.showNotification(title, options);
  } else if (typeof Notification !== "undefined" && Notification.permission === "granted") {
    new Notification(title, options);
  }
}

function buildBriefing() {
  const today = todayISO();
  const all = taskService.getAll();
  const todays = all.filter((t) => !t.completed && t.dueDate === today);
  const overdueCount = all.filter((t) => isOverdue(t)).length;

  if (todays.length === 0 && overdueCount === 0) {
    return {
      title: "Good morning — here's your day",
      body: "Your slate is clear today. Add something worth doing.",
    };
  }

  const parts = [`You have ${todays.length} task${todays.length === 1 ? "" : "s"} today`];
  if (overdueCount > 0) {
    parts.push(`${overdueCount} overdue`);
  }
  return {
    title: "Good morning — here's your day",
    body: parts.join(", ") + ". Let's go.",
  };
}

function msUntilNext(hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  const now = new Date();
  const next = new Date();
  next.setHours(h || 0, m || 0, 0, 0);
  if (next.getTime() <= now.getTime()) {
    next.setDate(next.getDate() + 1);
  }
  return next.getTime() - now.getTime();
}
