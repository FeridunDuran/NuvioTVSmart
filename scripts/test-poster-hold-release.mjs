import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";
const cases = [
  ["home/homeScreenMethods-08-open-hold-menu-for-node.js", "createHomeScreenMethods08", "home"],
  ["search/searchScreenMethods-03-render-recent-searches.js", "createSearchScreenMethods03"],
  ["search/discoverScreenMethods-03-open-picker-menu.js", "createDiscoverScreenMethods03"],
  ["cast/castDetailScreenMethods-02-remember-focused-card.js", "createCastDetailScreenMethods02"],
  [
    "tmdb/tmdbEntityBrowseScreenMethods-02-bind-shell-events.js",
    "createTmdbEntityBrowseScreenMethods02"
  ],
  [
    "catalog/catalogSeeAllScreenMethods-02-handle-grid-dpad.js",
    "createCatalogSeeAllScreenMethods02"
  ],
  ["library/libraryScreenMethods-04-render.js", "createLibraryScreenMethods04"],
  [
    "detail/metaDetailsScreenMethods-13-has-pending-hero-hold.js",
    "createMetaDetailsScreenMethods13"
  ],
  [
    "collection/folderDetailScreenMethods-04-load-more-follow-layout-row.js",
    "createFolderDetailScreenMethods04",
    "folder"
  ]
];
for (const [file, factory, kind] of cases) {
  test(`${file}: a delayed short release never opens title options; a long release does`, async () => {
    let menu = 0,
      detail = 0;
    const timers = [];
    class HTMLElement {}
    const node = Object.assign(new HTMLElement(), {
      dataset: { itemId: "1", itemType: "movie", focusKey: "1", action: "openDetail" },
      isConnected: true,
      classList: { contains: () => true },
      matches: () => true
    });
    const context = vm.createContext({
      internals: {
        Router: { getCurrent: () => (kind === "folder" ? "folderDetail" : "home") },
        POSTER_HOLD_DELAY_MS: 650,
        CW_HOLD_DELAY_MS: 650,
        HERO_HOLD_DELAY_MS: 650
      },
      HTMLElement,
      console,
      setTimeout: (fn) => {
        timers.push(fn);
        return timers.length;
      },
      clearTimeout: () => {}
    });
    async function load(path, name) {
      const s = await readFile(new URL(`../js/ui/screens/${path}`, import.meta.url), "utf8");
      vm.runInContext(s.replace(/^import .*$/gm, "").replace(/^export /gm, ""), context);
      return vm.runInContext(`${name}()`, context);
    }
    let methods = {};
    if (kind === "folder") methods = await load(cases[0][0], cases[0][1]);
    Object.assign(methods, await load(file, factory));
    const screen = {
      ...methods,
      useHomeFollowLayout: true,
      container: { querySelector: () => node },
      isPosterHoldTarget: () => true,
      isHomeHoldTarget: () => true,
      getPosterItemFromNode: () => ({ id: "1", type: "movie" }),
      getContinueWatchingItemFromNode: () => ({ contentId: "1" }),
      openPosterOptionsMenu: () => menu++,
      openHoldMenuForNode: () => menu++,
      openDetailFromNode: () => detail++,
      openMoreLikeDetailFromNode: () => detail++,
      activateNode: () => detail++
    };
    const start = kind ? "startPendingContinueWatchingHold" : "startPendingPosterHold";
    const complete = kind ? "completePendingContinueWatchingHold" : "completePendingPosterHold";
    screen[start](node);
    for (let i = 0; i < timers.length && i < 20; i++) timers[i](); // stalled event loop runs timers before queued keyup
    assert.equal(menu, 0, "elapsed JS timers are not proof of a physical hold");
    await screen[complete](node, { keyDownDurationMs: 30 });
    assert.equal(detail, 1);
    assert.equal(menu, 0);
    screen[start](node);
    await screen[complete](node, { keyDownDurationMs: 900 });
    assert.equal(menu, 1);
    assert.equal(detail, 1);
  });
}

test("detail hero hold also waits for release and keeps normal Play clicks", async () => {
  const context = vm.createContext({
    internals: { HERO_HOLD_DELAY_MS: 650 },
    setTimeout: () => {
      throw new Error("hold must not schedule a menu timer");
    }
  });
  const source = await readFile(
    new URL(
      "../js/ui/screens/detail/metaDetailsScreenMethods-13-has-pending-hero-hold.js",
      import.meta.url
    ),
    "utf8"
  );
  vm.runInContext(
    source.replace(/^import .*$/gm, "").replace(/^export /gm, "") +
      "\nthis.methods=createMetaDetailsScreenMethods13();",
    context
  );
  let menus = 0,
    plays = 0;
  const node = { dataset: { action: "playDefault" } };
  const screen = {
    ...context.methods,
    cancelPendingHeroHold() {
      this.pendingHeroHoldTarget = null;
      this.pendingHeroHoldActive = false;
    },
    openHeroPlayMenu: () => menus++,
    playDefaultFromHero: async () => plays++
  };
  screen.startPendingHeroHold(node);
  assert.equal(menus, 0);
  await screen.completePendingHeroHold(node, { keyDownDurationMs: 30 });
  assert.equal(plays, 1);
  screen.startPendingHeroHold(node);
  await screen.completePendingHeroHold(node, { keyDownDurationMs: 900 });
  assert.equal(menus, 1);
});
