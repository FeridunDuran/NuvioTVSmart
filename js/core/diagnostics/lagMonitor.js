// Personal build: always-on, low-cost lag telemetry for the Samsung Q70T.
//
// Records the user-visible delays that show up as "laggy" on a weak TV, so they can be read
// over the debug connection (window.__nuvioLag) without someone reporting them:
//   - key: time from a remote key press to the next painted frame, when it exceeds 150 ms
//   - hero: per focused hero, when its title, logo and IMDb rating first reached the screen,
//     flagged when the plain title showed before the logo or the logo/rating came late
// Each issue is also printed once as a "[NuvioLag]" console warning. Cost: one keydown
// listener, two rAF callbacks per key press, and a few Map operations per hero paint.

const BUFFER_LIMIT = 300;
const KEY_LAG_THRESHOLD_MS = 150;
const HERO_LATE_THRESHOLD_MS = 300;
const HERO_FINALIZE_MS = 4000;

const buffer = [];
const heroStates = new Map();
let installed = false;

function now() {
  return typeof performance !== "undefined" && typeof performance.now === "function"
    ? performance.now()
    : Date.now();
}

function currentRoute() {
  try {
    const shells = document.querySelectorAll("[class*='-shell']");
    for (let index = shells.length - 1; index >= 0; index -= 1) {
      if (shells[index].offsetParent) {
        return String(shells[index].className || "").split(" ")[0];
      }
    }
  } catch (_) {
    // Diagnostics must never throw into the app.
  }
  return "";
}

function record(entry) {
  const item = { at: Math.round(now()), route: currentRoute(), ...entry };
  buffer.push(item);
  if (buffer.length > BUFFER_LIMIT) {
    buffer.splice(0, buffer.length - BUFFER_LIMIT);
  }
  try {
    console.warn("[NuvioLag]", JSON.stringify(item));
  } catch (_) {
    // ignore
  }
}

export function installLagMonitor() {
  if (installed || typeof window === "undefined") {
    return;
  }
  installed = true;
  window.__nuvioLag = buffer;
  window.addEventListener(
    "keydown",
    (event) => {
      const pressedAt = now();
      const key = String(event?.key || event?.keyCode || "");
      // The frame after the handlers ran is the first one that can show the result.
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const delay = now() - pressedAt;
          if (delay > KEY_LAG_THRESHOLD_MS) {
            record({ type: "key", key, ms: Math.round(delay) });
          }
        });
      });
    },
    true
  );
}

function finalizeHero(id) {
  const state = heroStates.get(id);
  if (!state || state.done) {
    return;
  }
  state.done = true;
  if (state.timer) {
    clearTimeout(state.timer);
  }
  heroStates.delete(id);
  const rel = (value) => (value == null ? null : Math.round(value - state.focusAt));
  const titleMs = rel(state.titleAt);
  const logoMs = rel(state.logoAt);
  const ratingMs = rel(state.ratingAt);
  const textBeforeLogo =
    state.logoAt != null && state.textOnlyAt != null && state.textOnlyAt < state.logoAt;
  const lateLogo = logoMs != null && logoMs > HERO_LATE_THRESHOLD_MS;
  const lateRating = ratingMs != null && ratingMs > HERO_LATE_THRESHOLD_MS;
  if (
    textBeforeLogo ||
    lateLogo ||
    lateRating ||
    (titleMs != null && titleMs > HERO_LATE_THRESHOLD_MS)
  ) {
    record({
      type: "hero",
      id,
      titleMs,
      logoMs,
      ratingMs,
      textBeforeLogo,
      prefetched: Boolean(state.prefetched)
    });
  }
}

/** Call when focus lands on a card whose hero will be shown. */
export function markHeroFocus(id, { prefetched = false } = {}) {
  const key = String(id || "");
  if (!key) {
    return;
  }
  heroStates.forEach((_, otherId) => {
    if (otherId !== key) {
      finalizeHero(otherId);
    }
  });
  const existing = heroStates.get(key);
  if (existing && !existing.done) {
    return;
  }
  const state = {
    focusAt: now(),
    prefetched,
    titleAt: null,
    textOnlyAt: null,
    logoAt: null,
    ratingAt: null
  };
  state.timer = setTimeout(() => finalizeHero(key), HERO_FINALIZE_MS);
  heroStates.set(key, state);
}

/** Call after the hero DOM was updated for `id`. */
export function markHeroPaint(id, { hasLogo = false, hasRating = false } = {}) {
  const state = heroStates.get(String(id || ""));
  if (!state || state.done) {
    return;
  }
  const t = now();
  if (state.titleAt == null) {
    state.titleAt = t;
  }
  if (!hasLogo && state.textOnlyAt == null) {
    state.textOnlyAt = t;
  }
  if (hasLogo && state.logoAt == null) {
    state.logoAt = t;
  }
  if (hasRating && state.ratingAt == null) {
    state.ratingAt = t;
  }
  if (state.logoAt != null && state.ratingAt != null) {
    finalizeHero(String(id));
  }
}

export function getLagLog() {
  return buffer.slice();
}
