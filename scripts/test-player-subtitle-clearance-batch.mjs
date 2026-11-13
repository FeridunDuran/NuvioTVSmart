import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";
import * as clearance from "../js/ui/screens/player/subtitleOverlayClearance.js";

async function harness() {
  let reads = 0;
  const properties = new Map();
  const source = await readFile(
    new URL("../js/ui/screens/player/playerScreenMethods-32-update-ui-tick.js", import.meta.url),
    "utf8"
  );
  const context = vm.createContext({
    ...clearance,
    internals: {
      PlayerSettingsStore: { get: () => ({ skipIntroEnabled: false }) },
      PlayerController: {},
      clamp: (v, min, max) => Math.min(max, Math.max(min, v))
    },
    syncPlayerPlaybackBadges() {},
    MediaServerScrobbleService: { update() {} },
    setTimeout,
    clearTimeout
  });
  vm.runInContext(
    source.replace(/^import .*$/gm, "").replace(/^export /gm, "") +
      "\nthis.methods = createPlayerScreenMethods32();",
    context
  );
  const screen = {
    ...context.methods,
    uiRefs: {
      root: {
        getBoundingClientRect() {
          reads++;
          return { height: 1080, bottom: 1080 };
        },
        style: {
          getPropertyValue: (key) => properties.get(key),
          setProperty: (key, value) => properties.set(key, value)
        }
      }
    },
    liveWatchClock: { update: () => 0 },
    isExternalFrameMode: () => false,
    isLivePlayback: () => false,
    ensureNextEpisodeStreamsPrefetch() {},
    shouldShowNextEpisodeCard() {},
    refreshLoadingOverlayProgress() {},
    getPlaybackCurrentSeconds: () => 10,
    updateActiveSkipInterval() {},
    updateSkipIntroCountdown() {},
    getPlaybackDisplayCurrentSeconds: () => 10,
    getPlaybackDisplayDurationSeconds: () => 100,
    evaluatePostPlayRecommendation() {},
    syncSkipIntroButtonProgress() {},
    syncPlayerOverlayLayoutState() {},
    renderBitmapSubtitleAtCurrentTime() {},
    maybeAutoplayNextEpisode() {},
    syncPauseOverlayState() {},
    renderProgressPosition() {
      clearance.syncHtmlSubtitleClearance(this);
    },
    renderSkipIntroButton() {
      clearance.syncHtmlSubtitleClearance(this);
    },
    renderNextEpisodeCard() {
      clearance.syncHtmlSubtitleClearance(this);
    }
  };
  return { screen, reads: () => reads };
}

test("one player tick measures subtitle geometry once after all overlay renders", async () => {
  const { screen, reads } = await harness();
  screen.updateUiTick();
  assert.equal(reads(), 1, "four synchronous clearance requests collapse into one geometry pass");
  clearance.syncHtmlSubtitleClearance(screen);
  assert.equal(reads(), 2, "standalone key/resize calls still update synchronously");
});

test("an exception in player rendering cannot leave subtitle clearance suspended", async () => {
  const { screen, reads } = await harness();
  screen.renderSkipIntroButton = () => {
    throw new Error("render failed");
  };
  assert.throws(() => screen.updateUiTick(), /render failed/);
  assert.equal(reads(), 1, "pending placement flushes even when rendering fails");
  clearance.syncHtmlSubtitleClearance(screen);
  assert.equal(reads(), 2);
});

test("batched placement uses final overlay geometry and preserves synchronous placement values", async () => {
  const previousComputedStyle = globalThis.getComputedStyle;
  globalThis.getComputedStyle = () => ({ display: "block", visibility: "visible" });
  try {
    const { screen } = await harness();
    let top = 900;
    let placement;
    screen.controlsVisible = true;
    screen.uiRefs.controlsBottom = {
      classList: { contains: () => false },
      getClientRects: () => [1],
      getBoundingClientRect: () => ({ top, height: 80 })
    };
    screen.assSubtitleRenderer = {
      setPlacement(value) {
        placement = value;
      }
    };
    clearance.beginSubtitleClearanceBatch(screen);
    clearance.syncHtmlSubtitleClearance(screen);
    top = 800;
    clearance.beginSubtitleClearanceBatch(screen);
    clearance.syncHtmlSubtitleClearance(screen);
    clearance.endSubtitleClearanceBatch(screen);
    assert.equal(placement, undefined, "nested batches do not measure intermediate layout");
    clearance.endSubtitleClearanceBatch(screen);
    const finalPlacement = placement;
    assert.equal(finalPlacement.overlayTop, 784);
    clearance.syncHtmlSubtitleClearance(screen);
    assert.deepEqual(placement, finalPlacement);
  } finally {
    if (previousComputedStyle === undefined) delete globalThis.getComputedStyle;
    else globalThis.getComputedStyle = previousComputedStyle;
  }
});
