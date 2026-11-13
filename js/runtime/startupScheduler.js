import { hasMarkedFirstHomePaint, onFirstHomePaint } from "../core/diagnostics/bootTiming.js";

// When the session never reaches Home (profile picker, sign-in, a non-Home
// experience route) the deferred work still has to run; this bounds the wait.
const DEFAULT_FALLBACK_MS = 2500;
const DEFERRED_TASK_SPACING_MS = 250;
let nextDeferredTaskAt = 0;

// Runs startup work that is not needed for the first Home paint once that
// paint has happened, or after `fallbackMs`, whichever comes first. The task
// runs on its own macrotask so the frame that painted Home is not extended.
export function runAfterFirstHomePaint(task, { fallbackMs = DEFAULT_FALLBACK_MS } = {}) {
  if (typeof task !== "function") {
    return;
  }
  let done = false;
  let timer = null;
  let unsubscribe = () => {};
  const run = () => {
    if (done) {
      return;
    }
    done = true;
    unsubscribe();
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
    // Home's ready callback can notify several subscribers in one frame.
    // Give the browser a paint opportunity and space their starts, rather
    // than launching auth sync, badge images, updates and party IO together.
    const schedule = () => {
      const now = Date.now();
      const startAt = Math.max(now, nextDeferredTaskAt);
      nextDeferredTaskAt = startAt + DEFERRED_TASK_SPACING_MS;
      setTimeout(
        () => {
          try {
            Promise.resolve(task()).catch((error) =>
              console.warn("Deferred startup task failed", error)
            );
          } catch (error) {
            console.warn("Deferred startup task failed", error);
          }
        },
        Math.max(0, startAt - now)
      );
    };
    if (typeof requestAnimationFrame === "function") requestAnimationFrame(schedule);
    else schedule();
  };
  if (hasMarkedFirstHomePaint()) {
    run();
    return;
  }
  timer = setTimeout(run, Math.max(0, Number(fallbackMs) || 0));
  unsubscribe = onFirstHomePaint(run);
}
