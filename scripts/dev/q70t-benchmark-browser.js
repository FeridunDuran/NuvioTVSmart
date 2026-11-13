// Developer-only CDP injection. Never import this module from the production app.
// Concepts from SamSUCKS GPL-3.0: docs/SAMSUCKS-ATTRIBUTION.md.
import { createFrameBudgetSampler } from "../../js/core/diagnostics/frameBudget.js";
import { mountRecycledPilot } from "./q70t-recycled-pilot.js";

function home() {
  const root = document.getElementById("home");
  if (
    !root ||
    getComputedStyle(root).display === "none" ||
    root.classList.contains("home-dom-preserved")
  )
    throw new Error("Open Home before starting this benchmark");
  return root;
}
function counts() {
  const root = home();
  const focused = root.querySelector(".focusable.focused");
  return {
    focusRow: Number(focused?.dataset?.navRow ?? focused?.dataset?.rowIndex ?? -1),
    focusColumn: Number(focused?.dataset?.navCol ?? focused?.dataset?.itemIndex ?? -1),
    scrollTop: Number(root.querySelector(".home-modern-rows-viewport,.home-main")?.scrollTop || 0),
    nodes: root.querySelectorAll("*").length,
    cards: root.querySelectorAll(".home-content-card").length,
    images: root.querySelectorAll("img").length,
    loaded: Array.from(root.querySelectorAll("img")).filter(
      (img) => img.complete && img.naturalWidth
    ).length
  };
}
function itemsFromHome() {
  const seen = new Set();
  return Array.from(home().querySelectorAll(".home-content-card[data-item-id]"))
    .map((node) => ({
      id: node.dataset.itemId,
      title: node.dataset.itemTitle || node.getAttribute("aria-label") || "Title",
      poster: node.dataset.posterSrc || node.querySelector("img")?.getAttribute("src") || ""
    }))
    .filter((item) => {
      if (!item.id || seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    });
}
function background(mode) {
  if (mode === "baseline") return { destroy() {}, renderer: "baseline" };
  const target = home().querySelector(".home-modern-hero-media");
  if (!target) throw new Error("Background experiment requires modern Home hero media");
  const style = document.createElement("style");
  style.textContent =
    "#home .home-modern-hero-media::before,#home .home-modern-hero-media::after{background:none!important}";
  document.head.appendChild(style);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 2;
  canvas.style.cssText =
    "position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none;z-index:1;background:#111722";
  target.appendChild(canvas);
  let gl = null;
  let renderer = "flat";
  const onLost = (event) => {
    event.preventDefault();
    style.remove();
    canvas.style.display = "none";
    renderer = "context-lost-baseline";
  };
  canvas.addEventListener("webglcontextlost", onLost);
  if (mode === "webgl") {
    try {
      const options = {
        alpha: false,
        antialias: false,
        depth: false,
        stencil: false,
        preserveDrawingBuffer: true
      };
      gl = canvas.getContext("webgl", options) || canvas.getContext("experimental-webgl", options);
      if (gl) {
        renderer = "webgl";
        gl.enable(gl.SCISSOR_TEST);
        [
          [0.07, 0.1, 0.15],
          [0.025, 0.04, 0.065],
          [0.1, 0.045, 0.06],
          [0.02, 0.025, 0.04]
        ].forEach((color, index) => {
          gl.scissor(index % 2, index < 2 ? 1 : 0, 1, 1);
          gl.clearColor(...color, 1);
          gl.clear(gl.COLOR_BUFFER_BIT);
        });
      } else renderer = "flat-no-webgl";
    } catch (_) {
      renderer = "flat-webgl-error";
      try {
        gl?.getExtension("WEBGL_lose_context")?.loseContext();
      } catch (_) {}
      gl = null;
    }
  }

  return {
    get renderer() {
      return renderer;
    },
    destroy() {
      canvas.removeEventListener("webglcontextlost", onLost);
      style.remove();
      canvas.remove();
      gl?.getExtension("WEBGL_lose_context")?.loseContext();
      gl = null;
    }
  };
}

export function installQ70tBenchmark() {
  globalThis.__NUVIO_Q70T_BENCH__?.destroy();
  let sampler = null;
  let pilot = null;
  let backdrop = null;
  let before = null;
  let label = "";
  let previousQueue;
  let queueHadValue = false;
  let savedQueue = false;
  let generation = 0;
  const restore = () => {
    generation++;
    sampler?.stop();
    sampler = null;
    pilot?.destroy();
    pilot = null;
    backdrop?.destroy();
    backdrop = null;
    if (savedQueue) {
      if (queueHadValue) globalThis.__NUVIO_HOME_FRAME_NAV__ = previousQueue;
      else delete globalThis.__NUVIO_HOME_FRAME_NAV__;
      savedQueue = false;
    }
  };
  let latencies = [];
  const onKey = (event) => {
    if (!sampler || ![37, 38, 39, 40].includes(Number(event.keyCode))) return;
    const at = performance.now();
    const token = generation;
    requestAnimationFrame(() => {
      if (token === generation && latencies.length < 2000) latencies.push(performance.now() - at);
    });
  };
  window.addEventListener("keydown", onKey, true);
  const api = {
    begin(name) {
      if (sampler || pilot || backdrop) restore();
      home();
      if (document.body.classList.contains("nuvio-modal-open"))
        throw new Error("Close dialogs before benchmarking");
      queueHadValue = Object.prototype.hasOwnProperty.call(globalThis, "__NUVIO_HOME_FRAME_NAV__");
      previousQueue = globalThis.__NUVIO_HOME_FRAME_NAV__;
      savedQueue = true;
      label = String(name);
      before = counts();
      latencies = [];
      if (["row", "grid", "decode"].includes(label))
        pilot = mountRecycledPilot(itemsFromHome(), {
          grid: label === "grid",
          decode: label === "decode"
        });
      else {
        globalThis.__NUVIO_HOME_FRAME_NAV__ = label === "coalesced";
        backdrop = background(["flat", "webgl"].includes(label) ? label : "baseline");
      }
      sampler = createFrameBudgetSampler({ sampleLimit: 2000 });
      sampler.start();
      return { label, before, pilot: pilot?.snapshot() || null };
    },
    reset() {
      sampler?.reset();
      latencies = [];
    },
    end() {
      if (!sampler) throw new Error("No active benchmark");
      sampler.stop();
      const sorted = latencies.slice().sort((a, b) => a - b);
      const result = {
        label,
        frames: sampler.snapshot(),
        before,
        after: counts(),
        pilot: pilot?.snapshot() || null,
        renderer: backdrop?.renderer || "pilot",
        keyToNextRaf: {
          samples: sorted.length,
          p95: sorted.length ? sorted[Math.floor((sorted.length - 1) * 0.95)] : 0
        },
        note: "keyToNextRaf is not input-to-visible-presentation latency; visual background variants are not pixel-identical"
      };
      restore();
      return result;
    },
    destroy() {
      restore();
      window.removeEventListener("keydown", onKey, true);
      delete globalThis.__NUVIO_Q70T_BENCH__;
    }
  };
  globalThis.__NUVIO_Q70T_BENCH__ = api;
}
installQ70tBenchmark();
