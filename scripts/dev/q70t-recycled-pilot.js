// Independent experimental implementation inspired by SamSUCKS Row/Grid/images concepts.
// GPL-3.0; reference provenance is in docs/SAMSUCKS-ATTRIBUTION.md.
// This file is injected by the local CDP tool; it is not imported by js/app.js.
export function createPriorityImages({ decode = false, maxActive = 4 } = {}) {
  const queue = [];
  const tokens = new WeakMap();
  const loaders = new Map();
  let active = 0;
  let disposed = false;
  let serial = 0;
  const pump = () => {
    queue.sort((a, b) => a.priority - b.priority || b.serial - a.serial);
    while (!disposed && active < maxActive && queue.length) {
      const job = queue.shift();
      if (!job.image.isConnected || tokens.get(job.image) !== job.token) continue;
      const loader = new Image();
      active++;
      let done = false;
      let decodeTimer = null;
      const finish = (ok) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        clearTimeout(decodeTimer);
        loader.onload = loader.onerror = null;
        loaders.delete(loader);
        active--;
        if (!ok) loader.removeAttribute("src");
        if (
          !disposed &&
          ok &&
          job.image.isConnected &&
          tokens.get(job.image) === job.token &&
          job.image.getAttribute("src") !== job.src
        )
          job.image.src = job.src;
        pump();
      };
      const timer = setTimeout(() => finish(false), 8000);
      loaders.set(loader, () => {
        loader.removeAttribute("src");
        finish(false);
      });
      loader.onload = () => {
        if (decode && typeof loader.decode === "function") {
          decodeTimer = setTimeout(() => finish(true), 250);
          loader.decode().then(
            () => finish(true),
            () => finish(true)
          );
        } else finish(true);
      };
      loader.onerror = () => finish(false);
      loader.src = job.src;
    }
  };
  return {
    prioritize(image) {
      queue.forEach((job) => {
        if (job.image === image && tokens.get(image) === job.token) {
          job.priority = 0;
          job.serial = ++serial;
        }
      });
      pump();
    },
    load(image, src, priority = 1) {
      const token = ++serial;
      tokens.set(image, token);
      if (!src) {
        image.removeAttribute("src");
        return;
      }
      queue.push({ image, src, priority, token, serial });
      if (queue.length > 100) queue.splice(0, queue.length - 100);
      pump();
    },
    destroy() {
      disposed = true;
      queue.length = 0;
      Array.from(loaders.values()).forEach((cancel) => cancel());
      loaders.clear();
    }
  };
}

export function mountRecycledPilot(items, { grid = false, decode = false } = {}) {
  if (!items.length) throw new Error("No Home items available for the pilot");
  const previousFocus = document.activeElement;
  const root = document.createElement("section");
  root.setAttribute("role", "dialog");
  root.setAttribute("aria-label", "Q70T recycled navigation pilot");
  root.tabIndex = -1;
  root.style.cssText =
    "position:fixed;inset:0;z-index:2147483000;background:#10141c;color:white;overflow:hidden;font:24px Arial;padding:48px;box-sizing:border-box";
  const label = document.createElement("div");
  root.appendChild(label);
  const viewport = document.createElement("div");
  viewport.style.cssText =
    "position:absolute;left:64px;right:64px;top:120px;bottom:60px;overflow:hidden";
  root.appendChild(viewport);
  const track = document.createElement("div");
  track.style.cssText = "position:absolute;left:0;top:0;width:100%;height:100%";
  viewport.appendChild(track);
  const ring = document.createElement("div");
  ring.style.cssText =
    "position:absolute;left:0;top:0;width:198px;height:306px;box-sizing:border-box;border:5px solid #55d9ff;pointer-events:none;z-index:2";
  viewport.appendChild(ring);
  const columns = grid ? 6 : 1;
  const poolSize = Math.min(items.length, grid ? 24 : 12);
  const images = createPriorityImages({ decode });
  let index = 0;
  let destroyed = false;
  const slots = Array.from({ length: poolSize }, () => {
    const card = document.createElement("article");
    card.style.cssText = "position:absolute;left:0;top:0;width:198px;height:360px;overflow:hidden";
    const image = document.createElement("img");
    image.style.cssText = "width:198px;height:306px;object-fit:cover;background:#222";
    const title = document.createElement("div");
    title.style.cssText = "height:48px;overflow:hidden;font:20px Arial";
    card.appendChild(image);
    card.appendChild(title);
    track.appendChild(card);
    return { card, image, title, logical: -1 };
  });
  const writeTransform = (node, value) => {
    if (node.style.transform !== value) node.style.transform = value;
  };
  const render = () => {
    const row = Math.floor(index / columns);
    const first = grid ? Math.max(0, row - 1) * columns : Math.max(0, index - 2);
    const last = Math.min(items.length, first + poolSize);
    const usedSlots = new Set();
    for (let logical = first; logical < last; logical++) {
      const slot = slots[logical % poolSize];
      usedSlots.add(slot);
      if (slot.card.hidden) slot.card.hidden = false;
      const x = grid ? (logical % columns) * 250 : (logical - first) * 250;
      const y = grid ? (Math.floor(logical / columns) - Math.floor(first / columns)) * 390 : 0;
      writeTransform(slot.card, "translate(" + x + "px," + y + "px)");
      if (slot.logical !== logical) {
        slot.logical = logical;
        slot.card.dataset.logicalIndex = String(logical);
        const text = String(items[logical].title || "Untitled");
        if (slot.title.textContent !== text) slot.title.textContent = text;
        // Clear the previous poster before asynchronous recycled-node rebinding.
        slot.image.removeAttribute("src");
        slot.image.alt = text;
        images.load(slot.image, items[logical].poster, logical === index ? 0 : 1);
      }
      if (logical === index) images.prioritize(slot.image);
    }
    slots.forEach((slot) => {
      if (!usedSlots.has(slot) && !slot.card.hidden) slot.card.hidden = true;
    });
    writeTransform(
      track,
      grid ? "translateY(0px)" : "translateX(" + -(index - first) * 250 + "px)"
    );
    writeTransform(
      ring,
      grid
        ? "translate(" + (index % columns) * 250 + "px," + Math.min(row, 1) * 390 + "px)"
        : "translateX(0px)"
    );
    const text =
      "EXPERIMENTAL " +
      (grid ? "grid" : "row") +
      " · " +
      (index + 1) +
      "/" +
      items.length +
      " · pool=" +
      poolSize +
      " · Back: close · Enter: inspect only";
    if (label.textContent !== text) label.textContent = text;
  };
  const move = (key) => {
    const delta =
      key === "ArrowRight"
        ? 1
        : key === "ArrowLeft"
          ? -1
          : grid && key === "ArrowDown"
            ? columns
            : grid && key === "ArrowUp"
              ? -columns
              : 0;
    index = Math.max(0, Math.min(items.length - 1, index + delta));
    render();
  };
  const destroy = () => {
    if (destroyed) return;
    destroyed = true;
    window.removeEventListener("keydown", onKey, true);
    window.removeEventListener("keyup", onKeyUp, true);
    images.destroy();
    root.remove();
    const restoreTarget = previousFocus?.isConnected
      ? previousFocus
      : document.querySelector("#home .focusable.focused");
    restoreTarget?.focus({ preventScroll: true });
  };
  const keyName = (event) =>
    event.key ||
    {
      37: "ArrowLeft",
      38: "ArrowUp",
      39: "ArrowRight",
      40: "ArrowDown",
      13: "Enter",
      10009: "Back",
      27: "Escape",
      461: "Back"
    }[event.keyCode];
  const onKey = (event) => {
    const key = keyName(event);
    if (
      ![
        "ArrowLeft",
        "ArrowRight",
        "ArrowUp",
        "ArrowDown",
        "Enter",
        "Back",
        "Escape",
        "BrowserBack"
      ].includes(key)
    )
      return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (["Back", "Escape", "BrowserBack"].includes(key)) destroy();
    else move(key);
  };
  const onKeyUp = (event) => {
    event.preventDefault();
    event.stopImmediatePropagation();
  };
  document.body.appendChild(root);
  window.addEventListener("keydown", onKey, true);
  window.addEventListener("keyup", onKeyUp, true);
  root.focus({ preventScroll: true });
  render();
  return {
    destroy,
    snapshot: () => ({
      index,
      items: items.length,
      poolSize,
      grid,
      nodes: root.querySelectorAll("*").length
    })
  };
}
