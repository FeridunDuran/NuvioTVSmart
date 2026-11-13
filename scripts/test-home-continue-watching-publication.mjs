import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const deferred = () => {
  let resolve;
  const promise = new Promise((r) => {
    resolve = r;
  });
  return { promise, resolve };
};
const flush = async () => {
  for (let i = 0; i < 8; i++) await Promise.resolve();
};
function setup({
  background = false,
  existing = [],
  recent = [{ contentId: "movie-1", title: "Resume", positionMs: 60000 }],
  watched = Promise.resolve([]),
  enrichment = null
} = {}) {
  let route = "home";
  const internals = {
    Router: { getCurrent: () => route },
    watchProgressRepository: {
      getContinueWatchingSourceKey: () => "profile:a",
      getContinueWatchingRemoteProgressState: () => ({ sourceKey: "profile:a", loaded: true })
    },
    StartupSyncService: { isCurrentProfilePullPending: () => false },
    WatchProgressSource: { NUVIO_SYNC: "sync" },
    buildWatchedTitleIdSet: (items) => new Set(items),
    CW_MAX_NEXT_UP_LOOKUPS: 8,
    CW_MAX_VISIBLE_ITEMS: 20,
    shouldApplyLateContinueWatchingFocus: () => false,
    shouldProtectContinueWatchingDisplay: ({ existingCount, nextCount, hasLoadedRemoteProgress }) =>
      existingCount > 0 && !nextCount && !hasLoadedRemoteProgress,
    buildVisibleContinueWatchingItems: (items) => items.filter((item) => item.title),
    buildCompleteContinueWatchingDisplay: (items) => items,
    buildContinueWatchingSignature: (items) => JSON.stringify(items || []),
    buildHeroIdentity: () => ""
  };
  const context = vm.createContext({ internals, console });
  const source = readFileSync(
    new URL("../js/ui/screens/home/homeContinueWatchingLoad.js", import.meta.url),
    "utf8"
  )
    .replace(/^import .*;\r?\n/gm, "")
    .replace("export function", "function");
  const load = vm.runInContext(source + "\nstartHomeContinueWatchingLoad", context);
  const screen = {
    homeLoadToken: 1,
    continueWatchingDisplay: existing,
    continueWatchingLoading: !existing.length,
    continueWatchingInitialResolved: false,
    layoutMode: "modern",
    layoutPrefs: {},
    renders: 0,
    snapshots: 0,
    requestBackgroundRender() {
      this.renders++;
    },
    persistContinueWatchingSnapshot() {
      this.snapshots++;
    },
    clearContinueWatchingSnapshot() {},
    pickInitialHero() {
      return null;
    },
    refreshWatchedTitleState() {},
    selectNextUpProgressCandidates: () => [],
    maybeStartPendingHomeBackgroundRefresh() {},
    enrichContinueWatching: async (items) => (enrichment ? enrichment.promise : items)
  };
  const done = load.call(screen, {
    token: 1,
    watchedItemsPromise: watched,
    progressAllPromise: Promise.resolve(recent),
    recentProgressPromise: Promise.resolve(recent),
    progressErrors: {},
    continueWatchingSourceKey: "profile:a",
    continueWatchingSource: "local",
    nextUpSeedOptions: {},
    prefs: {},
    background,
    preserveHomeReturnState: background,
    suppressContinueWatchingLoading: background,
    hasExistingContinueWatchingDisplay: existing.length > 0
  });
  return {
    screen,
    done,
    navigateAway: () => {
      route = "detail";
      screen.homeLoadToken++;
    }
  };
}

test("cold Home paints resumable cards before slow watched history resolves", async () => {
  const watched = deferred();
  const { screen, done } = setup({ watched: watched.promise });
  await flush();
  assert.equal(screen.continueWatchingDisplay.length, 1);
  assert.equal(screen.continueWatchingLoading, false);
  assert.ok(screen.renders > 0);
  watched.resolve([]);
  await done;
});

test("background refresh repopulates an empty row before enrichment finishes", async () => {
  const enrichment = deferred();
  const { screen, done } = setup({ background: true, enrichment });
  await flush();
  assert.equal(screen.continueWatchingDisplay.length, 1);
  assert.ok(screen.renders > 0);
  enrichment.resolve(screen.continueWatchingDisplay);
  await done;
});

test("background refresh retains existing artwork while metadata is pending", async () => {
  const existing = [{ contentId: "movie-1", title: "Cached", poster: "cached.jpg" }];
  const enrichment = deferred();
  const { screen, done } = setup({ background: true, existing, enrichment });
  await flush();
  assert.equal(screen.continueWatchingDisplay, existing);
  enrichment.resolve([{ contentId: "movie-1", title: "Fresh", poster: "fresh.jpg" }]);
  await done;
  assert.equal(screen.continueWatchingDisplay[0].title, "Fresh");
});

test("a cancelled watched-history completion cannot overwrite the next route", async () => {
  const watched = deferred();
  const run = setup({ watched: watched.promise });
  await flush();
  run.navigateAway();
  const nextWatched = ["next-route"];
  run.screen.watchedItems = nextWatched;
  watched.resolve(["old-route"]);
  await run.done;
  assert.equal(run.screen.watchedItems, nextWatched);
});

test("an authoritative empty progress list still removes completed resume cards", async () => {
  const { screen, done } = setup({
    background: true,
    existing: [{ contentId: "finished", title: "Finished" }],
    recent: []
  });
  await done;
  assert.equal(screen.continueWatchingDisplay.length, 0);
});
