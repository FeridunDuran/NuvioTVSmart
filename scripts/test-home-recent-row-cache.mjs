import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

test("Home retains four recent rows and virtualizes only distant/unvisited contents", async () => {
  const source = await readFile(
    new URL("../js/ui/screens/home/homeScreenMethods-18-focus-node.js", import.meta.url),
    "utf8"
  );
  let options,
    removed = 0;
  const context = vm.createContext({
    internals: {},
    isHomeRowWindowSupported: () => true,
    HOME_ROW_WINDOW_SELECTOR: "rows",
    createHomeRowWindow: (opts) => {
      options = opts;
      return { observe() {} };
    },
    virtualizeHomeCard: () => {
      removed++;
      return true;
    },
    materializeHomeCard: () => false
  });
  vm.runInContext(
    source.replace(/^import .*$/gm, "").replace(/^export /gm, "") +
      "\nthis.methods=createHomeScreenMethods18();",
    context
  );
  const root = { querySelectorAll: () => [] };
  const screen = {
    ...context.methods,
    layoutMode: "modern",
    container: { querySelector: () => root },
    isPerformanceConstrained: () => true
  };
  screen.syncHomeRowWindow();
  const rows = Array.from({ length: 5 }, () => ({
    classList: { contains: () => true },
    querySelectorAll: () => [{}]
  }));
  rows.slice(0, 4).forEach((row) => options.onFocusRow(row));
  rows.slice(0, 4).forEach((row) => options.onPark(row));
  assert.equal(removed, 0);
  options.onPark(rows[4]);
  assert.equal(removed, 1, "unvisited rows release their contents");
  options.onFocusRow(rows[4]);
  assert.equal(removed, 2, "a fifth focused row evicts the oldest parked row");
});
