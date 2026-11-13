import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

async function harness() {
  let now = 10000;
  let hideStats = false;
  const requests = [];
  const source = await readFile(
    new URL(
      "../js/ui/screens/player/playerScreenMethods-19-refresh-loading-overlay-progress.js",
      import.meta.url
    ),
    "utf8"
  );
  const context = vm.createContext({
    internals: { TorrentSettingsStore: { get: () => ({ hideTorrentStats: hideStats }) } },
    Date: { now: () => now }
  });
  vm.runInContext(
    source.replace(/^import .*$/gm, "").replace(/^export /gm, "") +
      "\nthis.methods = createPlayerScreenMethods19();",
    context
  );
  const screen = {
    ...context.methods,
    currentEngineFsStream: { id: "a" },
    uiRefs: {},
    controlsVisible: true,
    loadingVisible: false,
    hasPresentedPlaybackFrame: true,
    torrentOverlayData: null,
    loadingTorrentStatus: "",
    isExternalFrameMode: () => false,
    isStartupErrorVisible: () => false,
    fetchCurrentEngineFsStats: () => new Promise((resolve) => requests.push(resolve)),
    getLoadingOverlayStatusText: (stats) => stats?.name || "",
    getLoadingOverlayProgress: () => 0.5,
    getTorrentOverlayData: (stats) => stats,
    syncLoadingOverlayStatus() {},
    syncTorrentOverlay() {},
    stopLoadingLogoFillAnimation() {},
    syncLoadingOverlayProgress() {}
  };
  return {
    screen,
    requests,
    advance: (ms) => {
      now += ms;
    },
    hide: () => {
      hideStats = true;
    }
  };
}

test("torrent UI polls at most once a second instead of once per 250 ms UI tick", async () => {
  const { screen, requests, advance } = await harness();
  for (let i = 0; i < 4; i++) {
    const pending = screen.refreshLoadingOverlayProgress();
    requests.at(-1)({ name: "stats" });
    await pending;
    advance(250);
  }
  assert.equal(requests.length, 1);
  const next = screen.refreshLoadingOverlayProgress();
  assert.equal(requests.length, 2);
  requests.at(-1)({ name: "new" });
  await next;
});

test("a late response from the previous stream does not change the new stream UI", async () => {
  const { screen, requests } = await harness();
  const old = screen.refreshLoadingOverlayProgress();
  screen.currentEngineFsStream = { id: "b" };
  requests[0]({ name: "old" });
  await old;
  assert.equal(screen.torrentOverlayData, null);
  const next = screen.refreshLoadingOverlayProgress();
  assert.equal(requests.length, 2, "a different stream bypasses the old stream's throttle");
  requests[1]({ name: "new" });
  await next;
  assert.equal(screen.torrentOverlayData.name, "new");
});

test("hiding stats during a request does not re-show stale overlay data", async () => {
  const { screen, requests, hide } = await harness();
  const pending = screen.refreshLoadingOverlayProgress();
  hide();
  requests[0]({ name: "old" });
  await pending;
  assert.equal(screen.torrentOverlayData, null);
});

test("a remounted player's in-flight request is not unlocked or overwritten by an old response", async () => {
  const { screen, requests } = await harness();
  const old = screen.refreshLoadingOverlayProgress();
  screen.loadingProgressRefreshInFlight = false; // mount resets this field
  screen.uiRefs = {};
  screen.currentEngineFsStream = { id: "b" };
  const next = screen.refreshLoadingOverlayProgress();
  requests[0]({ name: "old" });
  await old;
  assert.ok(screen.loadingProgressRefreshInFlight);
  assert.equal(screen.torrentOverlayData, null);
  requests[1]({ name: "new" });
  await next;
  assert.equal(screen.torrentOverlayData.name, "new");
  assert.equal(screen.loadingProgressRefreshInFlight, false);
});

test("playback starting during a request clears loading progress using the current state", async () => {
  const { screen, requests } = await harness();
  screen.loadingVisible = true;
  screen.hasPresentedPlaybackFrame = false;
  screen.loadingProgress = 0.1;
  const pending = screen.refreshLoadingOverlayProgress();
  screen.hasPresentedPlaybackFrame = true;
  screen.loadingVisible = false;
  requests[0]({ name: "stats" });
  await pending;
  assert.equal(screen.loadingProgress, null);
});

test("a source change starts fresh stats immediately without waiting for the old request", async () => {
  const { screen, requests } = await harness();
  const old = screen.refreshLoadingOverlayProgress();
  screen.currentEngineFsStream = { id: "b" };
  const next = screen.refreshLoadingOverlayProgress();
  assert.equal(requests.length, 2);
  requests[1]({ name: "new" });
  await next;
  requests[0]({ name: "old" });
  await old;
  assert.equal(screen.torrentOverlayData.name, "new");
  assert.equal(screen.loadingProgressRefreshInFlight, false);
});

test("hidden player controls do not poll optional torrent stats", async () => {
  const { screen, requests } = await harness();
  screen.controlsVisible = false;
  await screen.refreshLoadingOverlayProgress();
  assert.equal(requests.length, 0);
});
