/* ============================================================
   TaskFlow — Service Worker
   Strategies:
     - Precache the app shell on install
     - Navigation: network-first → cache → offline.html
     - Same-origin static (js/css/html/icons): stale-while-revalidate
     - Google Fonts (CSS): stale-while-revalidate
     - Google Fonts (woff2): cache-first (immutable)
   Lifecycle:
     - install: precache & skipWaiting
     - activate: clear old caches & claim clients
   Push: shows notification with task data
   Background Sync: drains the local sync queue (placeholder)
   ============================================================ */

const VERSION = "v1.1.0";
const PRECACHE = `taskflow-precache-${VERSION}`;
const RUNTIME = `taskflow-runtime-${VERSION}`;
const FONTS = `taskflow-fonts-${VERSION}`;

const APP_SHELL = [
  "./",
  "./index.html",
  "./offline.html",
  "./manifest.webmanifest",
  "./src/styles/main.css",
  "./src/styles/variables.css",
  "./src/styles/base.css",
  "./src/styles/components.css",
  "./src/app.js",
  "./src/storage/db.js",
  "./src/services/taskService.js",
  "./src/services/themeService.js",
  "./src/services/syncService.js",
  "./src/services/installService.js",
  "./src/services/notificationService.js",
  "./src/utils/eventBus.js",
  "./src/utils/dateUtils.js",
  "./src/utils/domUtils.js",
  "./src/utils/toast.js",
  "./src/components/Header.js",
  "./src/components/SearchBar.js",
  "./src/components/FilterBar.js",
  "./src/components/TaskList.js",
  "./src/components/TaskItem.js",
  "./src/components/TaskForm.js",
  "./src/components/taskFormHost.js",
  "./src/components/EmptyState.js",
  "./assets/icons/icon-192.png",
  "./assets/icons/icon-512.png",
  "./assets/icons/maskable-512.png",
  "./assets/icons/apple-touch-icon.png",
  "./assets/icons/favicon-32.png",
  "./assets/icons/favicon-64.png",
];

/* ---------- INSTALL ---------- */
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(PRECACHE)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

/* ---------- ACTIVATE ---------- */
self.addEventListener("activate", (event) => {
  const allowed = new Set([PRECACHE, RUNTIME, FONTS]);
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => !allowed.has(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/* ---------- FETCH ---------- */
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // Navigation requests: network-first with offline fallback
  if (req.mode === "navigate" || (req.destination === "document")) {
    event.respondWith(handleNavigation(req));
    return;
  }

  // Google Fonts CSS — stale-while-revalidate (changes occasionally)
  if (url.origin === "https://fonts.googleapis.com") {
    event.respondWith(staleWhileRevalidate(req, FONTS));
    return;
  }

  // Google Fonts woff2 — cache-first (immutable per URL)
  if (url.origin === "https://fonts.gstatic.com") {
    event.respondWith(cacheFirst(req, FONTS));
    return;
  }

  // Same-origin assets — stale-while-revalidate keeps things fresh without blocking paint
  if (url.origin === location.origin) {
    event.respondWith(staleWhileRevalidate(req, RUNTIME));
    return;
  }
});

/* ---------- STRATEGIES ---------- */

async function handleNavigation(req) {
  try {
    const fresh = await fetch(req);
    const cache = await caches.open(RUNTIME);
    cache.put(req, fresh.clone());
    return fresh;
  } catch {
    const cached = await caches.match(req);
    if (cached) return cached;
    const shell = await caches.match("./index.html");
    if (shell) return shell;
    return caches.match("./offline.html");
  }
}

async function staleWhileRevalidate(req, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(req);
  const network = fetch(req)
    .then((res) => {
      if (res && res.ok) cache.put(req, res.clone());
      return res;
    })
    .catch(() => null);
  return cached || (await network) || new Response("", { status: 504 });
}

async function cacheFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(req);
  if (cached) return cached;
  try {
    const res = await fetch(req);
    if (res && res.ok) cache.put(req, res.clone());
    return res;
  } catch {
    return new Response("", { status: 504 });
  }
}

/* ---------- MESSAGE (manual update path) ---------- */
self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});

/* ---------- PUSH ---------- */
self.addEventListener("push", (event) => {
  let payload = { title: "TaskFlow", body: "You have a reminder." };
  try {
    if (event.data) payload = { ...payload, ...event.data.json() };
  } catch {
    if (event.data) payload.body = event.data.text();
  }

  const options = {
    body: payload.body,
    icon: "./assets/icons/icon-192.png",
    badge: "./assets/icons/icon-192.png",
    tag: payload.tag || "taskflow",
    renotify: true,
    data: payload.data || {},
  };
  event.waitUntil(self.registration.showNotification(payload.title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ("focus" in client) return client.focus();
      }
      return self.clients.openWindow("./");
    })
  );
});

/* ---------- BACKGROUND SYNC ---------- */
self.addEventListener("sync", (event) => {
  if (event.tag === "taskflow-sync-tasks") {
    event.waitUntil(drainSyncQueue());
  }
});

/**
 * In v1 (no backend), we let the page perform the drain through its sync service.
 * If the page is open, the message will reach it; otherwise this will be a no-op.
 */
async function drainSyncQueue() {
  const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
  for (const client of clients) client.postMessage({ type: "sync:drain" });
}
