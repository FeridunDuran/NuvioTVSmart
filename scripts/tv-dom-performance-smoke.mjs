import {
  updateHomeDom,
  virtualizeHomeCard,
  materializeHomeCard
} from "../js/ui/screens/home/homeDomUpdate.js";
import { patchSearchRows, rememberSearchRows } from "../js/ui/screens/search/searchRowsDom.js";
import { createHomeRowWindow } from "../js/ui/screens/home/homeRowWindow.js";

let checks = 0;
const check = (condition, message) => {
  checks++;
  if (!condition) throw new Error(message);
};
const doc = document.implementation.createHTMLDocument("performance-smoke");
const root = doc.createElement("div");
doc.body.appendChild(root);
const markup = (name, src) =>
  `<div class="home-shell"><section class="home-row home-modern-row" data-row-key="r"><div class="home-track"><article class="home-content-card home-poster-card focusable" data-item-id="one" data-item-type="movie" style="--test-size:3px"><div class="home-poster-frame"><img class="content-poster" data-src="${src}"><span>${name}</span></div></article></div></section></div>`;
updateHomeDom(root, markup("First", "first.jpg"));
const card = root.querySelector("article");
card.classList.add("focused");
updateHomeDom(root, markup("Second", "second.jpg"), { incremental: true, focusedNode: card });
check(root.querySelector("article") === card, "Home card identity lost");
check(card.classList.contains("focused"), "Runtime focus lost");
check(card.textContent === "Second", "Home text not reconciled");
check(card.style.getPropertyValue("--test-size") === "3px", "Style snapshot lost");
card.classList.remove("focused");
const before = root.querySelectorAll("*").length;
check(virtualizeHomeCard(card), "Card did not virtualize");
check(card.childNodes.length === 0, "Virtual card still retains native descendants");
updateHomeDom(root, markup("Third", "third.jpg"), { incremental: true });
check(card.childNodes.length === 0, "Background refresh re-created a parked card");
check(materializeHomeCard(card), "Card did not materialize");
check(card.textContent === "Third", "Virtual refresh lost new title");
check(card.querySelector("img").dataset.src === "third.jpg", "Virtual refresh lost artwork");
const row = root.querySelector("section");
Object.defineProperty(row, "offsetHeight", { value: 300 });
let notify;
const win = createHomeRowWindow({
  scope: {
    IntersectionObserver: class {
      constructor(fn) {
        notify = fn;
      }
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  },
  onPark: (s) => s.querySelectorAll("article").forEach(virtualizeHomeCard),
  onRestore: (s) => s.querySelectorAll("article").forEach(materializeHomeCard)
});
win.observe([row]);
notify([{ target: row, isIntersecting: false }]);
check(card.childNodes.length === 0, "Row parking did not remove card contents");
win.ensureReady(card);
check(card.textContent === "Third", "Focused row was not ready synchronously");
win.destroy();
const content = doc.createElement("main");
content.innerHTML = "<header></header>";
const header = content.firstChild;
const a = { stateKey: "a" },
  b = { stateKey: "b" };
const watched = new Set();
const prefs = {};
const renderRow = (row) =>
  `<section class="search-results-row" data-row-key="${row.stateKey}"><div class="search-results-track"><article class="focusable">${row.stateKey}</article></div></section>`;
const patch = (rows) =>
  patchSearchRows({
    content,
    header,
    rows,
    watched,
    prefs,
    getKey: (r) => r.stateKey,
    renderRow,
    document: doc
  });
patch([b]);
const bNode = content.lastChild;
bNode.querySelector("div").scrollLeft = 70;
bNode.querySelector("article").classList.add("focused");
patch([a, b]);
check(content.lastChild === bNode, "Late catalog replaced the existing Search row");
check(bNode.querySelector("article").classList.contains("focused"), "Search focus lost");
check(content.firstChild === header, "Search header replaced");
patch([b]);
check(content.children.length === 2 && content.lastChild === bNode, "Search removed the wrong row");
rememberSearchRows(content, [b], watched, prefs, (r) => r.stateKey);
patch([b]);
check(content.lastChild === bNode, "Repeated Search patch replaced unchanged content");
let badgeUpdates = 0;
patchSearchRows({
  content,
  header,
  rows: [b],
  watched: new Set(["b"]),
  prefs,
  getKey: (r) => r.stateKey,
  renderRow,
  document: doc,
  updateWatched: () => badgeUpdates++
});
check(
  content.lastChild === bNode && badgeUpdates === 1,
  "Watched refresh must preserve the Search row"
);
globalThis.__nuvioDomPerfSmoke = {
  passed: true,
  homeNodesBefore: before,
  cardNodesAfterRestore: card.querySelectorAll("*").length,
  checks
};
