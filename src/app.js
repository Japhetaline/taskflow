/**
 * TaskFlow — app entry.
 *
 * Wires up:
 *  - Storage init
 *  - Services (theme, sync, install, notifications)
 *  - Component mounts
 *  - Service worker registration
 *  - Global UI affordances (FAB, offline banner)
 */

import * as taskService from "./services/taskService.js";
import * as themeService from "./services/themeService.js";
import * as syncService from "./services/syncService.js";
import * as installService from "./services/installService.js";
import * as notificationService from "./services/notificationService.js";

import { mountHeader } from "./components/Header.js";
import { mountSearchBar } from "./components/SearchBar.js";
import { mountFilterBar } from "./components/FilterBar.js";
import { mountTaskList } from "./components/TaskList.js";
import { openTaskForm, prefetchTaskForm } from "./components/taskFormHost.js";

import { bus, EVENTS } from "./utils/eventBus.js";

/* ------------------------------------------------------------ */
/* Boot                                                          */
/* ------------------------------------------------------------ */

async function boot() {
  // 1) Theme as early as possible (already pre-applied inline; this attaches listeners)
  themeService.init();

  // 2) Load tasks from IndexedDB
  await taskService.init();

  // 3) Mount UI (TaskForm is lazy — see taskFormHost)
  mountHeader(document.getElementById("app-header"));
  mountSearchBar(document.getElementById("search-section"));
  mountFilterBar(document.getElementById("filter-section"));
  mountTaskList(document.getElementById("list-section"));

  // 4) FAB → open new-task modal (lazy-loads TaskForm on first use)
  const fab = document.getElementById("fab-add");
  if (fab) fab.addEventListener("click", () => openTaskForm());

  // 5) Keyboard: "N" opens a new task. Lives here (not in TaskForm) so it
  //    works from boot, before the form module is loaded.
  window.addEventListener("keydown", (e) => {
    if (e.key !== "n" && e.key !== "N") return;
    const tag = document.activeElement?.tagName;
    const inField = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
    const modalOpen = !!document.querySelector(".modal-overlay");
    if (inField || modalOpen) return;
    e.preventDefault();
    openTaskForm();
  });

  // 6) Deep link: ?action=new — open the form immediately (manifest shortcut)
  if (new URLSearchParams(location.search).get("action") === "new") {
    openTaskForm();
  }

  // 7) Sync + install + notifications
  syncService.init();
  installService.init();
  initOnlineBanner();
  initNotificationPermissionLazyAsk();

  // 8) Service worker
  registerServiceWorker();

  // 9) Prefetch the task form during idle time so first interaction is instant
  schedulePrefetch();
}

function schedulePrefetch() {
  if ("requestIdleCallback" in window) {
    requestIdleCallback(() => prefetchTaskForm(), { timeout: 2000 });
  } else {
    setTimeout(prefetchTaskForm, 1500);
  }
}

document.addEventListener("DOMContentLoaded", boot);

/* ------------------------------------------------------------ */
/* Online/offline banner                                         */
/* ------------------------------------------------------------ */

function initOnlineBanner() {
  const banner = document.getElementById("offline-banner");
  if (!banner) return;
  const update = (online) => {
    banner.hidden = online;
  };
  update(navigator.onLine);
  bus.on(EVENTS.ONLINE_CHANGED, update);
}

/* ------------------------------------------------------------ */
/* Notifications — ask once after the first overdue-eligible task */
/* ------------------------------------------------------------ */

function initNotificationPermissionLazyAsk() {
  // We don't prompt on boot — that's intrusive. We ask the first time the user
  // adds a task with a future due date+time, since that's where the value is.
  const off = bus.on(EVENTS.TASKS_CHANGED, ({ added }) => {
    if (!added || !added.dueDate || !added.dueTime) return;
    if (notificationService.getPermission() === "default") {
      notificationService.requestPermission().then((perm) => {
        if (perm === "granted") {
          // Schedule a reminder for the just-added task
          notificationService.scheduleReminder(added);
        }
      });
      off(); // ask only once
    }
  });
}

/* ------------------------------------------------------------ */
/* Service Worker registration                                   */
/* ------------------------------------------------------------ */

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  // Defer to idle so it never competes with first paint
  const start = () => {
    navigator.serviceWorker
      .register("./service-worker.js", { scope: "./" })
      .then((reg) => {
        // Listen for updates
        reg.addEventListener("updatefound", () => {
          const newSW = reg.installing;
          if (!newSW) return;
          newSW.addEventListener("statechange", () => {
            if (newSW.state === "installed" && navigator.serviceWorker.controller) {
              // New version waiting — could show "Update available" UI
              console.info("[taskflow] new service worker installed; refresh to update");
            }
          });
        });
      })
      .catch((err) => console.error("[taskflow] SW registration failed:", err));
  };
  if ("requestIdleCallback" in window) requestIdleCallback(start);
  else window.addEventListener("load", start);
}
