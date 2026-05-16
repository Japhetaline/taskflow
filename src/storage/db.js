/**
 * IndexedDB wrapper for TaskFlow.
 *
 * Design notes:
 *  - Single DB, multiple object stores so we can grow (tasks, meta, sync_queue).
 *  - Promise API hiding the request/event ergonomics of native IDB.
 *  - Versioning + onupgradeneeded handles forward-compatible schema migrations.
 *  - All writes return the updated record so callers can update UI optimistically.
 */

const DB_NAME = "taskflow-db";
const DB_VERSION = 1;

export const STORES = Object.freeze({
  TASKS: "tasks",
  META: "meta",
  SYNC_QUEUE: "sync_queue",
});

let _dbPromise = null;

/**
 * Get a singleton DB connection.
 */
export function openDB() {
  if (_dbPromise) return _dbPromise;

  _dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (event) => {
      const db = req.result;
      const oldVersion = event.oldVersion;

      // v1 — initial schema
      if (oldVersion < 1) {
        if (!db.objectStoreNames.contains(STORES.TASKS)) {
          const tasks = db.createObjectStore(STORES.TASKS, { keyPath: "id" });
          tasks.createIndex("by_dueDate", "dueDate", { unique: false });
          tasks.createIndex("by_completed", "completed", { unique: false });
          tasks.createIndex("by_category", "category", { unique: false });
          tasks.createIndex("by_syncStatus", "syncStatus", { unique: false });
          tasks.createIndex("by_createdAt", "createdAt", { unique: false });
        }
        if (!db.objectStoreNames.contains(STORES.META)) {
          db.createObjectStore(STORES.META, { keyPath: "key" });
        }
        if (!db.objectStoreNames.contains(STORES.SYNC_QUEUE)) {
          const sq = db.createObjectStore(STORES.SYNC_QUEUE, {
            keyPath: "id",
            autoIncrement: true,
          });
          sq.createIndex("by_op", "op", { unique: false });
          sq.createIndex("by_createdAt", "createdAt", { unique: false });
        }
      }
      // Future migrations: if (oldVersion < 2) { ... }
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error("Failed to open IndexedDB"));
    req.onblocked = () => reject(new Error("IndexedDB upgrade blocked by another tab"));
  });

  return _dbPromise;
}

/**
 * Run a transaction and resolve when it completes.
 * Callback receives the store(s) and a `done(value)` helper to set the result.
 */
async function tx(storeNames, mode, run) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const names = Array.isArray(storeNames) ? storeNames : [storeNames];
    const transaction = db.transaction(names, mode);
    let result;

    transaction.oncomplete = () => resolve(result);
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error || new Error("Transaction aborted"));

    const stores = names.length === 1
      ? transaction.objectStore(names[0])
      : Object.fromEntries(names.map((n) => [n, transaction.objectStore(n)]));

    Promise.resolve(run(stores, (val) => (result = val))).catch((err) => {
      try { transaction.abort(); } catch (_) {}
      reject(err);
    });
  });
}

function reqToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/* ---------- TASKS ---------- */

export async function getAllTasks() {
  return tx(STORES.TASKS, "readonly", async (store, done) => {
    const all = await reqToPromise(store.getAll());
    done(all);
  });
}

export async function getTask(id) {
  return tx(STORES.TASKS, "readonly", async (store, done) => {
    done(await reqToPromise(store.get(id)));
  });
}

export async function putTask(task) {
  return tx(STORES.TASKS, "readwrite", async (store, done) => {
    await reqToPromise(store.put(task));
    done(task);
  });
}

export async function deleteTask(id) {
  return tx(STORES.TASKS, "readwrite", async (store, done) => {
    await reqToPromise(store.delete(id));
    done(id);
  });
}

export async function clearTasks() {
  return tx(STORES.TASKS, "readwrite", async (store, done) => {
    await reqToPromise(store.clear());
    done(true);
  });
}

/* ---------- META ---------- */

export async function getMeta(key) {
  return tx(STORES.META, "readonly", async (store, done) => {
    const row = await reqToPromise(store.get(key));
    done(row ? row.value : undefined);
  });
}

export async function setMeta(key, value) {
  return tx(STORES.META, "readwrite", async (store, done) => {
    await reqToPromise(store.put({ key, value }));
    done(value);
  });
}

/* ---------- SYNC QUEUE (for future backend integration) ---------- */

export async function enqueueSync(entry) {
  return tx(STORES.SYNC_QUEUE, "readwrite", async (store, done) => {
    const id = await reqToPromise(
      store.add({ ...entry, createdAt: Date.now() })
    );
    done(id);
  });
}

export async function getPendingSync() {
  return tx(STORES.SYNC_QUEUE, "readonly", async (store, done) => {
    done(await reqToPromise(store.getAll()));
  });
}

export async function dequeueSync(id) {
  return tx(STORES.SYNC_QUEUE, "readwrite", async (store, done) => {
    await reqToPromise(store.delete(id));
    done(id);
  });
}
