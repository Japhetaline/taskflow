/**
 * Date helpers — all functions are pure and timezone-aware (local time).
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Returns a Date set to local midnight for the given date. */
export function startOfDay(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** True if two dates are the same calendar day. */
export function isSameDay(a, b) {
  return startOfDay(a).getTime() === startOfDay(b).getTime();
}

export function isToday(date) {
  return isSameDay(date, new Date());
}

export function isTomorrow(date) {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return isSameDay(date, tomorrow);
}

export function isYesterday(date) {
  const y = new Date();
  y.setDate(y.getDate() - 1);
  return isSameDay(date, y);
}

/** Number of whole days between two dates (b - a). */
export function daysBetween(a, b) {
  return Math.round((startOfDay(b) - startOfDay(a)) / MS_PER_DAY);
}

/** True if the task's due date+time is in the past. */
export function isOverdue(task, now = new Date()) {
  if (!task.dueDate || task.completed) return false;
  const due = combineDateTime(task.dueDate, task.dueTime);
  return due.getTime() < now.getTime();
}

/** Combine an ISO date (YYYY-MM-DD) and optional time (HH:mm) into a Date. */
export function combineDateTime(dateStr, timeStr) {
  if (!dateStr) return null;
  const [y, m, d] = dateStr.split("-").map(Number);
  let h = 23, min = 59;
  if (timeStr) {
    const parts = timeStr.split(":").map(Number);
    h = parts[0] ?? 0;
    min = parts[1] ?? 0;
  }
  return new Date(y, m - 1, d, h, min, 0, 0);
}

/** Human-friendly date label: "Today", "Tomorrow", "Wed, Mar 15", or "Mar 15, 2026". */
export function formatDateLabel(date) {
  const d = typeof date === "string" ? new Date(`${date}T00:00:00`) : date;
  if (isToday(d)) return "Today";
  if (isTomorrow(d)) return "Tomorrow";
  if (isYesterday(d)) return "Yesterday";
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString(undefined, {
    weekday: sameYear ? "short" : undefined,
    month: "short",
    day: "numeric",
    year: sameYear ? undefined : "numeric",
  });
}

/** "08:30" -> "8:30 AM" (locale-aware) */
export function formatTime(timeStr) {
  if (!timeStr) return "";
  const [h, m] = timeStr.split(":").map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

/** Returns the YYYY-MM-DD string for today (local). */
export function todayISO() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/** Group tasks by their dueDate (YYYY-MM-DD). No-date tasks bucket under "no-date". */
export function groupByDate(tasks) {
  /** @type {Map<string, any[]>} */
  const groups = new Map();
  for (const t of tasks) {
    const key = t.dueDate || "no-date";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(t);
  }
  // Sort dates ascending; "no-date" at end
  const entries = Array.from(groups.entries()).sort(([a], [b]) => {
    if (a === "no-date") return 1;
    if (b === "no-date") return -1;
    return a.localeCompare(b);
  });
  return entries;
}

/** Sort tasks within a group: incomplete first, then by time, then by createdAt. */
export function sortTasksWithinGroup(tasks) {
  return [...tasks].sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    if (a.dueTime && b.dueTime) return a.dueTime.localeCompare(b.dueTime);
    if (a.dueTime) return -1;
    if (b.dueTime) return 1;
    return (a.createdAt || 0) - (b.createdAt || 0);
  });
}
