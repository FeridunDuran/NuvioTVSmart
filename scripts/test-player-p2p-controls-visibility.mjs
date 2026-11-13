import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import { readFile } from "node:fs/promises";

test("P2P overlay visibility follows controls even when the data is unchanged", async () => {
  const source = await readFile(
    new URL(
      "../js/ui/screens/player/playerScreenMethods-16-refresh-loading-overlay-presentation.js",
      import.meta.url
    ),
    "utf8"
  );
  const ctx = vm.createContext({
    internals: { TorrentSettingsStore: { get: () => ({ hideTorrentStats: false }) } }
  });
  vm.runInContext(
    source.replace(/^import .*$/gm, "").replace(/^export /gm, "") +
      "\nthis.methods=createPlayerScreenMethods16();",
    ctx
  );
  const classes = new Set();
  const attributes = new Map();
  const overlay = {
    classList: {
      toggle(k, on) {
        if (on) classes.add(k);
        else classes.delete(k);
      }
    },
    setAttribute: (k, v) => attributes.set(k, v)
  };
  const screen = {
    ...ctx.methods,
    controlsVisible: true,
    torrentOverlayData: { speedText: "1 MB/s", detailText: "5 peers" },
    uiRefs: { torrentOverlay: overlay }
  };
  screen.syncTorrentOverlay();
  assert.equal(classes.has("hidden"), false);
  screen.controlsVisible = false;
  screen.syncTorrentOverlay();
  assert.equal(classes.has("hidden"), true);
  assert.equal(attributes.get("aria-hidden"), "true");
  screen.controlsVisible = true;
  screen.syncTorrentOverlay();
  assert.equal(classes.has("hidden"), false);
});
