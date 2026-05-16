/**
 * StatsBar — three compact pills showing streak, weekly count, and total.
 *
 * Subscribes to TASKS_CHANGED so it stays in sync after any mutation.
 * statsService.init() must have run before this component is mounted.
 */

import { h, mount } from "../utils/domUtils.js";
import { bus, EVENTS } from "../utils/eventBus.js";
import * as statsService from "../services/statsService.js";

export function mountStatsBar(container) {
  if (!container) return;

  const render = () => mount(container, [renderBar()]);
  render();

  // statsService subscribes to TASKS_CHANGED first (it inits before this
  // mounts), so its cache is up-to-date by the time we read on the same event.
  bus.on(EVENTS.TASKS_CHANGED, render);
}

function renderBar() {
  const { streak, weeklyCompleted, totalCompleted } = statsService.getStats();

  const streakPill = streak > 0
    ? h("span", { class: "stats-pill" }, [
        h("span", { class: "stats-icon", "aria-hidden": "true" }, "🔥"),
        h("span", {}, [h("span", { class: "stats-num" }, String(streak)), "-day streak"]),
      ])
    : h("span", { class: "stats-pill is-empty" }, [
        h("span", { class: "stats-icon", "aria-hidden": "true" }, "🔥"),
        h("span", {}, "Start your streak"),
      ]);

  return h("div", { class: "stats-bar", role: "group", "aria-label": "Productivity stats" }, [
    streakPill,
    h("span", { class: "stats-pill" }, [
      h("span", { class: "stats-icon", "aria-hidden": "true" }, "✅"),
      h("span", {}, [h("span", { class: "stats-num" }, String(weeklyCompleted)), " this week"]),
    ]),
    h("span", { class: "stats-pill" }, [
      h("span", {}, [h("span", { class: "stats-num" }, String(totalCompleted)), " total"]),
    ]),
  ]);
}
