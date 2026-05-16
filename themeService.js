/**
 * ThemeService — manages light/dark theme with system fallback.
 * Persists the user's explicit choice to localStorage. If no choice has been
 * made, follows the OS preference and reacts to changes.
 */

import { bus, EVENTS } from "../utils/eventBus.js";

const STORAGE_KEY = "taskflow:theme";
const THEMES = ["light", "dark"];

let currentTheme = "light";
let userChose = false;

export function init() {
  const stored = safeGet();
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;

  if (stored && THEMES.includes(stored)) {
    userChose = true;
    apply(stored);
  } else {
    apply(prefersDark ? "light" : "dark");
  }

  // Follow OS changes while user hasn't picked
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  mq.addEventListener?.("change", (e) => {
    if (!userChose) apply(e.matches ? "light" : "dark");
  });
}

export function get() {
  return currentTheme;
}

export function set(theme) {
  if (!THEMES.includes(theme)) return;
  userChose = true;
  safeSet(theme);
  apply(theme);
}

export function toggle() {
  set(currentTheme === "light" ? "dark" : "light");
}

function apply(theme) {
  currentTheme = theme;
  document.documentElement.setAttribute("data-theme", theme);
  // Address-bar color is handled by the per-scheme <meta name="theme-color">
  // tags in index.html; nothing to update here.
  bus.emit(EVENTS.THEME_CHANGED, theme);
}

function safeGet() {
  try { return localStorage.getItem(STORAGE_KEY); } catch { return null; }
}
function safeSet(v) {
  try { localStorage.setItem(STORAGE_KEY, v); } catch {}
}
