import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

async function methods() {
  const context = vm.createContext({
    internals: {
      isRootSidebarNode: () => false,
      focusWithoutAutoScroll() {},
      MODERN_HOME_CONSTANTS: {}
    }
  });
  for (const [file, name] of [
    ["01-get-route-state-key", "01"],
    ["04-open-sidebar", "04"]
  ]) {
    const source = await readFile(
      new URL(`../js/ui/screens/search/searchScreenMethods-${file}.js`, import.meta.url),
      "utf8"
    );
    vm.runInContext(source.replace(/^import .*$/gm, "").replace(/^export /gm, ""), context);
  }
  return vm.runInContext(
    "({...createSearchScreenMethods01(), ...createSearchScreenMethods04()})",
    context
  );
}

test("horizontal Search focus captures only its row instead of scanning all 40 rows", async () => {
  let rowReads = 0;
  const rows = Array.from({ length: 40 }, (_, index) => ({
    dataset: { rowKey: String(index) },
    querySelector() {
      rowReads++;
      return { scrollLeft: index * 10 };
    }
  }));
  const content = { scrollTop: 70 };
  const node = () => ({
    dataset: { navZone: "results" },
    classList: { add() {}, remove() {} },
    closest: () => rows[5]
  });
  const screen = {
    ...(await methods()),
    container: {
      querySelector: () => content,
      querySelectorAll: (selector) => (selector === ".search-results-row" ? rows : [])
    },
    layoutPrefs: { modernSidebar: true },
    rememberContentFocus() {},
    ensureResultsRowVisible() {},
    ensureResultCardVisible() {}
  };
  screen.focusNode(node(), node());
  assert.equal(rowReads, 1);
  assert.equal(screen.rowScrollLeftByKey["5"], 50);
  assert.equal(screen.contentScrollTop, 70);
  rowReads = 0;
  screen.captureLiveViewState();
  assert.equal(rowReads, 40, "route snapshots still capture every row");
});

test("Search direct track children scroll by offset coordinates without rectangle measurements", async () => {
  let rectReads = 0;
  let targetScroll;
  const track = {
    scrollLeft: 50,
    scrollWidth: 1000,
    clientWidth: 200,
    getBoundingClientRect() {
      rectReads++;
      return { left: 20 };
    }
  };
  const target = {
    offsetParent: track,
    offsetLeft: 300,
    closest: () => track,
    getBoundingClientRect() {
      rectReads++;
      return { left: 270 };
    }
  };
  const screen = {
    ...(await methods()),
    animateScroll(_node, _axis, value) {
      targetScroll = value;
    }
  };
  screen.ensureResultCardVisible(null, target);
  assert.equal(targetScroll, 300);
  assert.equal(rectReads, 0);
  target.offsetParent = {};
  screen.ensureResultCardVisible(null, target);
  assert.equal(targetScroll, 300);
  assert.equal(rectReads, 2, "nested/transformed cards keep the geometry fallback");
});
