import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";
test("constrained Home does not preload or publish hero textures while D-pad focus is moving", async () => {
  const source = await readFile(
    new URL(
      "../js/ui/screens/home/homeScreenMethods-10-schedule-modern-hero-update.js",
      import.meta.url
    ),
    "utf8"
  );
  let now = 1000,
    id = 0,
    preloads = 0,
    commits = 0;
  const timers = new Map();
  const ctx = vm.createContext({
    internals: {
      MODERN_HOME_CONSTANTS: { heroRapidNavThresholdMs: 130 },
      buildHeroIdentity: (h) => h?.id || "",
      shouldEnrichModernHero: () => false,
      preloadHeroAssets: () => preloads++
    },
    getTvRuntimePerformanceProfile: () => ({ isPerformanceConstrained: true }),
    isModernTvProfile: () => false,
    getHeroEnrichDwellMs: () => 500,
    Date: { now: () => now },
    setTimeout: (fn, delay) => {
      timers.set(++id, { fn, at: now + delay });
      return id;
    },
    clearTimeout: (key) => timers.delete(key),
    requestAnimationFrame: (fn) => fn()
  });
  vm.runInContext(
    source.replace(/^import .*$/gm, "").replace(/^export /gm, "") +
      "\nthis.methods=createHomeScreenMethods10();",
    ctx
  );
  let focused;
  const screen = {
    ...ctx.methods,
    layoutMode: "modern",
    heroCandidates: [],
    container: { querySelector: () => null },
    getNodeHeroSource: (n) => ({ id: n.id }),
    getCurrentFocusedNode: () => focused,
    getHeroFocusDelay: ({ rapid }) => (rapid ? 350 : 300),
    cancelPendingHeroFocus() {
      timers.delete(this.heroFocusDelayTimer);
      timers.delete(this.heroBackdropPreloadTimer);
    },
    applyHeroToDom: () => commits++,
    syncCollectionHeroMedia() {},
    isModernHydrationScrollActive: () => false
  };
  const advance = (ms) => {
    now += ms;
    for (const [key, timer] of [...timers])
      if (timer.at <= now) {
        timers.delete(key);
        timer.fn();
      }
  };
  for (let index = 0; index < 8; index++) {
    focused = { id: String(index), isConnected: true, classList: { contains: () => true } };
    screen.scheduleModernHeroUpdate(focused);
    advance(180);
  }
  assert.equal(preloads, 0);
  assert.equal(commits, 0);
  advance(400);
  assert.equal(commits, 1);
  assert.equal(screen.heroItem.id, "7");
});
