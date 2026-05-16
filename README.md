# TaskFlow

> A premium, offline-first Progressive Web App for managing tasks. Built from scratch with vanilla HTML, CSS, and JavaScript — production-grade architecture, no framework, no build step.

![Built with: HTML · CSS · JS](https://img.shields.io/badge/Built%20with-HTML%20·%20CSS%20·%20JS-1a1714) ![PWA](https://img.shields.io/badge/PWA-installable-d97706) ![Offline](https://img.shields.io/badge/Works-offline-15803d)

---

## Overview

**TaskFlow** is a task manager that feels like a native mobile app. Capture tasks with dates and times, organize them by category and priority, mark them done, and trust that everything stays put even with no network — your data lives in IndexedDB on the device.

The codebase is intentionally framework-free for v1, but structured so it can graduate to React, Vue, or Svelte without rewriting the storage, services, or domain logic. The boundary between **storage → services → components** is the same one you'd find in a well-organized React app — just expressed with ES modules and a tiny event bus.

---

## Features

### Core (shipped)
- ✅ Create, edit, delete tasks
- ✅ Mark tasks complete (with undo)
- ✅ Due dates and times
- ✅ Categories (Work, Personal, Health, Learning, Errand, Other)
- ✅ Priority (Low, Normal, High)
- ✅ Overdue tasks highlighted in red
- ✅ Group tasks by date (Today, Tomorrow, ...)
- ✅ Filters: All · Today · Upcoming · Overdue · Completed (with live counts)
- ✅ Search (debounced)
- ✅ Dark mode (follows OS, persists user choice)
- ✅ Mobile-first responsive design
- ✅ **Works offline** — full app shell cached
- ✅ **Installable** — `manifest.webmanifest`, custom install banner, app shortcuts
- ✅ Local task reminders (Notifications API)
- ✅ Keyboard shortcuts: `N` (new task), `/` (focus search), `Esc` (close modal), `T` (toggle theme via button)
- ✅ Deep links from app shortcuts: `?action=new`, `?filter=today`

### Advanced (wired, ready to extend)
- 🔌 **Background Sync** — service worker registers `taskflow-sync-tasks`; sync queue is persisted in IndexedDB
- 🔌 **Push notifications** — service worker has `push` and `notificationclick` handlers; client has `subscribeToPush(vapidKey)`
- 🔌 **Backend sync** — every mutation is enqueued in IndexedDB with op type (`create | update | delete`); plug `deliver()` in `syncService.js` into your API
- 🔌 **Auth** — service layer is the natural place to add a token-aware client

---

## Tech stack

| Layer | Choice | Why |
| --- | --- | --- |
| Markup | HTML5 + semantic regions | A11y baseline; PWA meta tags |
| Styles | Vanilla CSS with design tokens | Zero runtime cost; theme via `data-theme` attribute |
| Scripts | ES Modules, no bundler | Browser-native; works directly on any static host |
| Storage | **IndexedDB** (custom promise wrapper) | Async, structured, scales to thousands of records |
| PWA | Manifest + Service Worker | Installable + offline + push + background sync |
| Fonts | Fraunces + Geist (Google Fonts, cached by SW) | Distinctive serif/grotesque pairing — premium feel |

No `node_modules`. No bundler. No build step. Open `index.html` on a static server and ship.

---

## How it works

### Architecture

```
┌──────────────────────────────────────────────────────────┐
│  Components (DOM)                                         │
│  Header · SearchBar · FilterBar · TaskList · TaskForm     │
└────────────┬──────────────────────────────────┬──────────┘
             │ emit / subscribe                  │ render
             ▼                                   ▲
┌──────────────────────────────────────────────────────────┐
│  Event Bus (utils/eventBus.js)                            │
│  TASKS_CHANGED · FILTER_CHANGED · SEARCH_CHANGED · …      │
└────────────┬──────────────────────────────────────────────┘
             │ calls
             ▼
┌──────────────────────────────────────────────────────────┐
│  Services (business logic)                                │
│  taskService · themeService · syncService · installService│
│  notificationService                                       │
└────────────┬──────────────────────────────────────────────┘
             │ uses
             ▼
┌──────────────────────────────────────────────────────────┐
│  Storage Layer (storage/db.js)                            │
│  IndexedDB: tasks · meta · sync_queue                     │
└──────────────────────────────────────────────────────────┘
```

The flow is unidirectional: **components → services → storage**, and changes flow back via the event bus. Components never touch IndexedDB directly, so swapping the storage adapter (e.g., to a backend) is a one-file change.

### Service worker strategy

| Request type | Strategy | Cache |
| --- | --- | --- |
| Navigation (`document`) | Network-first → cached shell → `offline.html` | `taskflow-runtime-v1.0.0` |
| Same-origin JS / CSS / icons | Stale-while-revalidate | `taskflow-runtime-v1.0.0` |
| Google Fonts CSS | Stale-while-revalidate | `taskflow-fonts-v1.0.0` |
| Google Fonts `.woff2` | Cache-first | `taskflow-fonts-v1.0.0` |
| Precache (install) | App shell (HTML, CSS, JS, icons) | `taskflow-precache-v1.0.0` |

The version constant is bumped on every release; the `activate` handler clears any cache not on the allowlist.

### Data model

```js
Task {
  id:          string        // crypto.randomUUID()
  title:       string        // required, ≤200 chars
  description: string        // optional, ≤1000 chars
  dueDate:     string        // YYYY-MM-DD (local), optional
  dueTime:     string        // HH:mm (local), optional
  category:    "work" | "personal" | "health" | "learn" | "errand" | "other"
  priority:    "low" | "normal" | "high"
  completed:   boolean
  createdAt:   number        // Date.now()
  updatedAt:   number
  syncStatus:  "synced" | "pending"
}
```

Indexed on: `dueDate`, `completed`, `category`, `syncStatus`, `createdAt`.

---

## Project structure

```
taskflow/
├── index.html                    # App shell
├── offline.html                  # Offline fallback
├── manifest.webmanifest          # PWA manifest
├── service-worker.js             # Caching, push, background sync
├── README.md
├── assets/
│   └── icons/                    # 192, 512, maskable, apple-touch, favicons
└── src/
    ├── app.js                    # Entry point — boots everything
    ├── styles/
    │   ├── main.css              # @imports the others
    │   ├── variables.css         # Design tokens (light + dark)
    │   ├── base.css              # Reset + layout
    │   └── components.css        # All component styles
    ├── storage/
    │   └── db.js                 # IndexedDB Promise wrapper
    ├── services/
    │   ├── taskService.js        # Task CRUD + cache + events
    │   ├── themeService.js       # Light/dark with system fallback
    │   ├── syncService.js        # Drains sync queue
    │   ├── installService.js     # beforeinstallprompt + banner
    │   └── notificationService.js# Local reminders + push subscribe
    ├── utils/
    │   ├── eventBus.js           # Tiny pub/sub
    │   ├── dateUtils.js          # Date grouping / formatting
    │   ├── domUtils.js           # `h()` element factory + icons
    │   └── toast.js              # Toast notifications
    └── components/
        ├── Header.js
        ├── SearchBar.js
        ├── FilterBar.js
        ├── TaskList.js
        ├── TaskItem.js
        ├── TaskForm.js           # Modal: create/edit
        └── EmptyState.js
```

---

## How to run

TaskFlow is a static site. You need any static server (PWAs require HTTP/HTTPS — `file://` won't register a service worker).

### Option 1 — Python (no install required)
```bash
cd taskflow
python3 -m http.server 8080
```
Open <http://localhost:8080>.

### Option 2 — Node
```bash
cd taskflow
npx serve -l 8080
# or
npx http-server -p 8080 -c-1
```

### Option 3 — Any host
Drop the folder on Netlify, Vercel, Cloudflare Pages, GitHub Pages, S3 + CloudFront, etc. No build step. Just upload.

### Testing the PWA

1. Open in **Chrome** or **Edge**.
2. Open DevTools → **Application** tab:
   - **Manifest** — verify the icons, theme color, shortcuts.
   - **Service Workers** — confirm it's activated; toggle **Offline** to test offline-mode.
   - **Storage** — inspect IndexedDB → `taskflow-db` → `tasks`.
3. Open DevTools → **Lighthouse** → run an audit with **Progressive Web App** checked.
4. To test install: look for the install icon in the address bar, or wait for the install banner.

### Keyboard shortcuts

| Key | Action |
| --- | --- |
| `N` | New task |
| `/` | Focus search |
| `Esc` | Close modal |

---

## Future improvements

These have hooks in place; they are implementation, not architecture changes.

- **Backend sync.** Replace the no-op `deliver()` in `src/services/syncService.js` with `fetch()` calls to your API. The sync queue already records every mutation with `{op, taskId}`. Add auth headers in one place.
- **Real-time multi-device sync.** Layer in WebSocket or Server-Sent Events on top of the same service.
- **Auth.** Add an `authService.js` exposing `signIn / signOut / currentUser`. Use it in `syncService.deliver()`.
- **Recurring tasks.** Add `recurrence: { freq, interval, until }` to the model; expand on read.
- **Subtasks / checklists.** Add a `subtasks: Task[]` property; component layer is the only change.
- **Tags + multi-category.** Replace `category: string` with `tags: string[]`.
- **Drag-and-drop reordering.** Add a `position: number` field and sort by it.
- **Calendar view.** Read from the same IndexedDB store; render with a grid.
- **Migrate to React.** The services and storage layer are framework-agnostic. Replace `src/components/*` with React components — that's it.
- **Web Share Target.** Accept tasks shared from other apps via `manifest.share_target`.
- **CSP & SRI.** Add a strict Content-Security-Policy header and Subresource Integrity for the font CDN.

---

## Performance notes

- **No JS framework** — initial JS payload is ~25 KB uncompressed across all modules.
- **CSS is split** into tokens/base/components so the cascade is predictable and tree-shakeable later.
- **Service worker precaches the app shell** so second loads are instant.
- **`requestIdleCallback`** defers SW registration off the critical path.
- **Stale-while-revalidate** keeps fonts and assets fresh without blocking paint.
- **No layout shift** — the theme is applied inline before first paint to avoid FOUC.
- **`content-visibility`-ready** — the task group structure is friendly to virtualization if the list grows past ~500 items.

---

## Browser support

- Chrome / Edge / Brave: full support (install, push, background sync).
- Firefox: full support (install, push). Background Sync is not supported — the sync service falls back to `online` event drain.
- Safari (iOS 16.4+ / macOS 16.4+): install + notifications. No Background Sync — same fallback as Firefox.

---

## License

MIT. Use it, fork it, ship it.

---

Built with intention. No shortcuts that you'll regret in six months.
