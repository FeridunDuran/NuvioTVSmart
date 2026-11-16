// Personal build: crash "black box" for the Samsung Q70T.
//
// The TV keeps no reachable logs once the app process dies, so the last events are persisted
// in localStorage and survive an unexpected close:
//   - console warnings/errors (via consoleDebugBuffer) and uncaught errors/rejections
//   - a memory/route sample every 20 s
//   - a session marker; if the previous session did not end cleanly, the next start records
//     an "unclean-exit" entry with the previous session's last events.
// Read over the debug connection: JSON.parse(localStorage.nuvioBlackBox) and
// JSON.parse(localStorage.nuvioBlackBoxCrashes).
import { subscribeToConsoleDebugEvents, getLastConsoleDebugEvent } from "./consoleDebugBuffer.js";

const KEY = "nuvioBlackBox";
const CRASH_KEY = "nuvioBlackBoxCrashes";
const MAX_EVENTS = 120;
const MAX_CRASHES = 5;
const FLUSH_DELAY_MS = 2000;
const SAMPLE_MS = 20000;
const MAX_MESSAGE = 400;

let state = null;
let flushTimer = null;

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (_) {
    return fallback;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (_) {
    // Storage full or unavailable: the black box must never break the app.
  }
}

function route() {
  try {
    const shells = document.querySelectorAll("[class*='-shell']");
    for (let index = shells.length - 1; index >= 0; index -= 1) {
      if (shells[index].offsetParent) return String(shells[index].className || "").split(" ")[0];
    }
  } catch (_) {
    // ignore
  }
  return "";
}

function memory() {
  const m = typeof performance !== "undefined" ? performance.memory : null;
  return m
    ? { heapMb: Math.round(m.usedJSHeapSize / 1e6), limitMb: Math.round(m.jsHeapSizeLimit / 1e6) }
    : null;
}

function scheduleFlush(immediate = false) {
  if (immediate) {
    if (flushTimer) clearTimeout(flushTimer);
    flushTimer = null;
    write(KEY, state);
    return;
  }
  if (!flushTimer) {
    flushTimer = setTimeout(() => {
      flushTimer = null;
      write(KEY, state);
    }, FLUSH_DELAY_MS);
  }
}

export function blackBoxRecord(type, message, extra = null) {
  if (!state) return;
  state.events.push({
    t: Date.now(),
    type,
    route: route(),
    msg: String(message == null ? "" : message).slice(0, MAX_MESSAGE),
    ...(extra ? { extra } : {})
  });
  if (state.events.length > MAX_EVENTS) state.events.splice(0, state.events.length - MAX_EVENTS);
  state.lastAliveAt = Date.now();
  scheduleFlush(type === "error" || type === "uncaught" || type === "player-error");
}

export function installBlackBox() {
  if (state || typeof window === "undefined") return;
  const previous = read(KEY, null);
  if (previous && previous.sessionId && !previous.cleanExit) {
    const crashes = read(CRASH_KEY, []);
    crashes.push({
      sessionId: previous.sessionId,
      startedAt: previous.startedAt,
      lastAliveAt: previous.lastAliveAt,
      lastRoute: previous.lastRoute,
      lastMemory: previous.lastMemory,
      lastEvents: (previous.events || []).slice(-40)
    });
    write(CRASH_KEY, crashes.slice(-MAX_CRASHES));
  }
  state = {
    sessionId: `${Date.now().toString(36)}`,
    startedAt: Date.now(),
    lastAliveAt: Date.now(),
    cleanExit: false,
    lastRoute: "",
    lastMemory: null,
    events: []
  };
  write(KEY, state);

  subscribeToConsoleDebugEvents(() => {
    // The console buffer notifies on every captured warn/error; record the newest one.
    try {
      const last = getLastConsoleDebugEvent();
      if (last) blackBoxRecord(last.level || last.type || "log", last.message);
    } catch (_) {
      // ignore
    }
  });
  window.addEventListener("error", (event) => {
    blackBoxRecord(
      "uncaught",
      `${event?.message || "error"} @${event?.filename || ""}:${event?.lineno || 0}`
    );
  });
  window.addEventListener("unhandledrejection", (event) => {
    const reason = event?.reason;
    blackBoxRecord("uncaught", `unhandled rejection: ${reason?.message || reason || ""}`);
  });
  setInterval(() => {
    if (!state) return;
    state.lastAliveAt = Date.now();
    state.lastRoute = route();
    state.lastMemory = memory();
    scheduleFlush();
  }, SAMPLE_MS);
  const markClean = () => {
    if (!state) return;
    state.cleanExit = true;
    state.lastAliveAt = Date.now();
    scheduleFlush(true);
  };
  const markOpen = () => {
    if (!state) return;
    state.cleanExit = false;
    scheduleFlush(true);
  };
  window.addEventListener("pagehide", markClean);
  window.addEventListener("beforeunload", markClean);
  // Leaving to the TV home or another app hides the page; a kill while hidden is the
  // system's normal memory management, not an app crash. Visible again means "open".
  document.addEventListener("visibilitychange", () => (document.hidden ? markClean() : markOpen()));
}
