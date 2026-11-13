import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

async function harness() {
  const queued = [];
  const canceled = [];
  let focuses = 0;
  const classes = new Set();
  const child = {
    dataset: { skipIntroThemeBound: "1" },
    classList: { toggle() {} },
    focus() {
      focuses++;
    }
  };
  const button = {
    innerHTML: "existing",
    classList: {
      toggle(key, on) {
        if (on) classes.add(key);
        else classes.delete(key);
      },
      contains: (key) => classes.has(key)
    },
    querySelector: () => child
  };
  const source = await readFile(
    new URL(
      "../js/ui/screens/player/playerScreenMethods-09-render-skip-intro-button.js",
      import.meta.url
    ),
    "utf8"
  );
  const context = vm.createContext({
    internals: {
      isPlayerDomNodeAttached: () => true,
      findFollowingPostCreditsScene: () => false,
      buildSkipIntervalLabel: () => "Skip intro",
      clamp: (v, min, max) => Math.min(max, Math.max(min, v)),
      escapeHtml: String
    },
    syncHtmlSubtitleClearance() {},
    document: { activeElement: null },
    requestAnimationFrame: (fn) => {
      queued.push(fn);
      return queued.length;
    },
    cancelAnimationFrame: (id) => canceled.push(id)
  });
  vm.runInContext(
    source.replace(/^import .*$/gm, "").replace(/^export /gm, "") +
      "\nthis.methods = createPlayerScreenMethods09();",
    context
  );
  const screen = {
    ...context.methods,
    uiRefs: { skipIntro: button },
    activeSkipInterval: { type: "intro", startTime: 0, endTime: 30 },
    controlsVisible: false,
    skipIntroRenderedKey: "intro:0:30|ready:1|controls:0|hidden:0|dismissed:0",
    skipIntroCountdownProgress: 0.5,
    isSkipIntroPlaybackReady: () => true,
    getPlaybackDurationSeconds: () => 100,
    syncSkipIntroButtonProgress() {},
    syncSkipIntroButtonTheme() {}
  };
  return { screen, queued, canceled, focuses: () => focuses };
}

test("hiding skip intro cancels a queued focus frame and stale callbacks cannot steal focus", async () => {
  const { screen, queued, canceled, focuses } = await harness();
  screen.renderSkipIntroButton();
  assert.equal(queued.length, 1);
  screen.skipIntroAutoHidden = true;
  screen.renderSkipIntroButton();
  assert.deepEqual(canceled, [1]);
  assert.equal(screen.skipIntroFocusFrame, null);
  queued[0](); // even if a callback was already dispatched before cancellation
  assert.equal(focuses(), 0);
});

test("visible skip intro still receives focus", async () => {
  const { screen, queued, focuses } = await harness();
  screen.renderSkipIntroButton();
  queued[0]();
  assert.equal(focuses(), 1);
});
