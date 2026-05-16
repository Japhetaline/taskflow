/**
 * StatsService — productivity streak + weekly + total-completed counters.
 *
 * State is persisted via the META store (key/value over IndexedDB) and mirrored
 * in an in-memory cache so getStats() is synchronous. Mutations happen
 * synchronously in the cache and the IDB writes are fire-and-forget.
 *
 *  - currentStreak / lastCompletedDate: incremented on first completion of
 *    a calendar day, reset to 1 if the previous completion was >1 day ago.
 *  - weeklyCompleted / weeklyCompletedWeek: per-ISO-week counter, reset
 *    when the week rolls over.
 *  - totalCompleted: derived from the task cache on every TASKS_CHANGED.
 */

import * as db from "../storage/db.js";
import * as taskService from "./taskService.js";
import { bus, EVENTS } from "../utils/eventBus.js";
import { todayISO } from "../utils/dateUtils.js";

const META = Object.freeze({
  STREAK: "stats:currentStreak",
  LAST_DATE: "stats:lastCompletedDate",
  WEEK_COUNT: "stats:weeklyCompleted",
  WEEK_KEY: "stats:weeklyCompletedWeek",
});

const _cache = {
  streak: 0,
  weeklyCompleted: 0,
  totalCompleted: 0,
};
let _lastDate = null;
let _currentWeek = null;

export async function init() {
  _cache.streak = Number((await db.getMeta(META.STREAK)) || 0);
  _lastDate = (await db.getMeta(META.LAST_DATE)) || null;
  _currentWeek = (await db.getMeta(META.WEEK_KEY)) || null;
  _cache.weeklyCompleted = Number((await db.getMeta(META.WEEK_COUNT)) || 0);

  // Roll over weekly counter if the ISO week changed since last session
  const week = isoWeek(new Date());
  if (_currentWeek !== week) {
    _currentWeek = week;
    _cache.weeklyCompleted = 0;
    db.setMeta(META.WEEK_KEY, week);
    db.setMeta(META.WEEK_COUNT, 0);
  }

  // Expire streak if more than one day has passed since the last completion
  if (_lastDate && daysBetweenISO(_lastDate, todayISO()) > 1) {
    _cache.streak = 0;
    db.setMeta(META.STREAK, 0);
  }

  // Seed totalCompleted from the current in-memory task set
  _cache.totalCompleted = taskService.getAll().filter((t) => t.completed).length;

  // Subscribe AFTER seeding so we don't double-count on init
  bus.on(EVENTS.TASKS_CHANGED, ({ all }) => {
    if (!all) return;
    _cache.totalCompleted = all.filter((t) => t.completed).length;
  });

  bus.on(EVENTS.TASK_COMPLETED, () => recordCompletion());
}

export function getStats() {
  return { ..._cache };
}

function recordCompletion() {
  const today = todayISO();
  const week = isoWeek(new Date());

  // Streak: same day → no change; consecutive day → +1; gap → reset to 1
  if (_lastDate === today) {
    // unchanged
  } else if (_lastDate && daysBetweenISO(_lastDate, today) === 1) {
    _cache.streak += 1;
  } else {
    _cache.streak = 1;
  }
  _lastDate = today;

  // Weekly: rollover if the ISO week label changed
  if (_currentWeek !== week) {
    _currentWeek = week;
    _cache.weeklyCompleted = 1;
  } else {
    _cache.weeklyCompleted += 1;
  }

  // Persist asynchronously — cache is already authoritative
  db.setMeta(META.STREAK, _cache.streak);
  db.setMeta(META.LAST_DATE, today);
  db.setMeta(META.WEEK_KEY, week);
  db.setMeta(META.WEEK_COUNT, _cache.weeklyCompleted);
}

/* ---------- date helpers ---------- */

function daysBetweenISO(a, b) {
  const da = parseISO(a);
  const db_ = parseISO(b);
  return Math.round((db_ - da) / 86400000);
}

function parseISO(s) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d).getTime();
}

/** ISO week label (Thursday-anchored): "YYYY-Www". */
function isoWeek(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNum).padStart(2, "0")}`;
}
