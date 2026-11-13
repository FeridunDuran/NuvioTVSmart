import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

async function methods(internals = {}, globals = {}) {
  const source = await readFile(
    new URL(
      "../js/ui/screens/search/searchScreenMethods-01-get-route-state-key.js",
      import.meta.url
    ),
    "utf8"
  );
  const context = vm.createContext({
    ...globals,
    internals: { Router: { getCurrent: () => "search" }, ...internals }
  });
  vm.runInContext(
    source.replace(/^import .*$/gm, "").replace(/^export /gm, "") +
      "\nthis.methods = createSearchScreenMethods01();",
    context
  );
  return context.methods;
}

test("final search completion does not redraw rows already published progressively", async () => {
  const rows = [{ items: [{ id: "one" }] }];
  let renders = 0;
  const screen = {
    ...(await methods()),
    loadToken: 1,
    query: "alien",
    mode: "search",
    rows: [],
    searchRows: async (_query, { onFirstResults }) => {
      onFirstResults(rows);
      return rows.slice();
    },
    refreshWatchedTitleIds: async () => false,
    shouldPatchResultsWithoutReplacingInput: () => false,
    requestRender: () => renders++
  };
  await screen.reloadRows();
  assert.equal(renders, 1);
});

test("watched badges from an old search cannot overwrite the current search", async () => {
  let finish;
  const oldIds = new Set(["current"]);
  const screen = {
    ...(await methods({
      watchedItemsRepository: {
        getAll: () =>
          new Promise((resolve) => {
            finish = resolve;
          })
      },
      watchedTitleStateRepository: { getTitleWatchedItems: async () => ["stale"] },
      buildWatchedTitleIdSet: (items) => new Set(items)
    })),
    loadToken: 1,
    rows: [],
    watchedTitleIds: oldIds
  };
  const pending = screen.refreshWatchedTitleIds();
  screen.loadToken++;
  finish([]);
  await pending;
  assert.equal(screen.watchedTitleIds, oldIds);
});

test("unchanged watched badges report no change and avoid a redundant results render", async () => {
  const screen = {
    ...(await methods({
      watchedItemsRepository: { getAll: async () => [] },
      watchedTitleStateRepository: { getTitleWatchedItems: async () => ["one"] },
      buildWatchedTitleIdSet: (items) => new Set(items)
    })),
    loadToken: 1,
    rows: [],
    watchedTitleIds: new Set(["one"])
  };
  assert.equal(await screen.refreshWatchedTitleIds(), false);
});

test("a slow watched projection cannot replace badges after another query begins", async () => {
  let finish;
  const oldIds = new Set(["current"]);
  const screen = {
    ...(await methods({
      watchedItemsRepository: { getAll: async () => [] },
      watchedTitleStateRepository: {
        getTitleWatchedItems: () =>
          new Promise((resolve) => {
            finish = resolve;
          })
      },
      buildWatchedTitleIdSet: (items) => new Set(items)
    })),
    loadToken: 1,
    rows: [],
    watchedTitleIds: oldIds
  };
  const pending = screen.refreshWatchedTitleIds();
  await new Promise((resolve) => setImmediate(resolve));
  screen.loadToken++;
  finish(["stale"]);
  await pending;
  assert.equal(screen.watchedTitleIds, oldIds);
});

test("fresh Search starts catalog requests without waiting for watched-history IO", async () => {
  let searches = 0;
  let watchedReads = 0;
  const screen = {
    ...(await methods(
      {
        ScreenUtils: { show() {} },
        LayoutPreferences: { get: () => ({}) },
        SearchHistoryStore: { list: () => [] },
        Platform: { isBrowser: () => false },
        getSidebarProfileState: async () => null
      },
      { document: { getElementById: () => ({}) } }
    )),
    hydrateFromRouteState() {
      this.query = "alien";
      this.mode = "search";
    },
    cancelActiveSearchRequests() {},
    render() {},
    refreshWatchedTitleIds() {
      watchedReads++;
      return new Promise(() => {});
    },
    reloadRows: async () => {
      searches++;
    }
  };
  await screen.mount();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(searches, 1, "a slow account service must not postpone addon requests");
  assert.equal(
    watchedReads,
    0,
    "reloadRows projects watched state against the actual returned rows"
  );
});
