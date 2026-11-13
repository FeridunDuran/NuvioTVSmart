import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const source = await readFile(
  new URL("../js/ui/screens/search/searchScreenMethods-02-load-discover-rows.js", import.meta.url),
  "utf8"
);
async function scenario(cancel = false, reverse = false) {
  let now = 1000;
  let nextTimer = 0;
  const timers = new Map();
  const pending = [];
  const catalogs = [0, 1, 2].map((id) => ({
    catalogId: String(id),
    catalogName: String(id),
    type: "movie"
  }));
  let formattedRows = 0;
  const fixtures = {
    addonRepository: { getInstalledAddons: async () => [] },
    catalogRepository: { getCatalog: () => new Promise((resolve) => pending.push(resolve)) },
    buildSearchTargets: () => catalogs,
    buildSearchScheduleIndices: () => [0, 1, 2],
    getSearchCatalogBatchSize: () => 3,
    getSearchResultsPerRow: () => 12,
    getSearchCatalogTimeoutMs: () => 6500,
    withTimeout: (promise) => promise,
    formatCatalogRowTitle: (name) => {
      formattedRows++;
      return name;
    },
    buildRowStateKey: (row, index) => `${row.catalogId}:${index}`
  };
  const context = vm.createContext({
    fixtures,
    Date: { now: () => now },
    setTimeout: (fn, delay) => {
      const id = ++nextTimer;
      timers.set(id, { fn, at: now + delay });
      return id;
    },
    clearTimeout: (id) => timers.delete(id),
    console
  });
  vm.runInContext(
    source.replace(/^import .*;\r?\n/gm, "").replace("export function", "function"),
    context
  );
  vm.runInContext("const internals = fixtures", context);
  const methods = vm.runInContext("createSearchScreenMethods02()", context);
  const screen = { loadToken: 1, layoutPrefs: {} };
  const published = [];
  const snapshots = [];
  const result = methods.searchRows.call(screen, "alien", {
    onFirstResults: (rows) => {
      published.push(rows.length);
      snapshots.push(rows);
    }
  });
  const flush = () => new Promise((resolve) => setImmediate(resolve));
  await flush();
  const success = (id) => ({ status: "success", data: { items: [{ id }] } });
  pending[reverse ? 1 : 0](success("first"));
  await flush();
  assert.deepEqual(published, [1]);
  now += 50;
  pending[reverse ? 0 : 1](success("second"));
  await flush();
  assert.deepEqual(published, [1]);
  assert.equal(timers.size, 1);
  if (cancel) screen.loadToken++;
  now = 1400;
  for (const [id, timer] of [...timers]) {
    if (timer.at <= now) {
      timers.delete(id);
      timer.fn();
    }
  }
  assert.deepEqual(
    published,
    cancel ? [1] : [1, 2],
    "ready rows publish while the third catalog is still pending"
  );
  pending[2]({ status: "error" });
  assert.equal((await result).length, 2);
  if (!cancel) {
    const first = snapshots[0][0];
    const sameCatalog = snapshots[1].find((row) => row.catalogId === first.catalogId);
    assert.equal(
      first.stateKey,
      sameCatalog.stateKey,
      "late catalogs cannot change an existing row's identity"
    );
    assert.equal(
      first,
      sameCatalog,
      "published rows are reused rather than rebuilt for every response"
    );
    assert.equal(formattedRows, 2, "each completed catalog is formatted once");
  }
  assert.equal(timers.size, 0);
}
await scenario();
await scenario(true);
await scenario(false, true);
console.log("search progressive publication tests passed");
