/**
 * taskFormHost — Lazy loader for TaskForm.
 *
 * Provides `openTaskForm(task?)` and `prefetchTaskForm()` that dynamically
 * import TaskForm on first use so the main bundle stays small.
 */

let _formModule = null;
let _mounted = false;

async function ensureLoaded() {
  if (!_formModule) {
    _formModule = await import("./TaskForm.js");
  }
  if (!_mounted) {
    const root = document.getElementById("modal-root");
    if (root) {
      _formModule.mountTaskForm(root);
      _mounted = true;
    }
  }
  return _formModule;
}

/**
 * Open the task form modal.
 * @param {object} [task] — If provided, edit this task. Otherwise, create new.
 */
export async function openTaskForm(task) {
  const mod = await ensureLoaded();
  mod.open(task);
}

/**
 * Prefetch the TaskForm module during idle time so first interaction is instant.
 */
export async function prefetchTaskForm() {
  await ensureLoaded();
}
