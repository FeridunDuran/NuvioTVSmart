// Local, outbound-only Chrome DevTools client. No HTTP/WebSocket server or arbitrary JS option.
import { build } from "esbuild";
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
const args = process.argv.slice(2);
if (args.includes("--help")) {
  console.log(
    "Usage: node scripts/q70t-benchmark.mjs --case baseline|coalesced|flat|webgl|row|grid|decode --interval 16..1000 --steps right,right,left,left --out artifacts/report.json"
  );
  process.exit(0);
}
const allowed = new Set(["--case", "--interval", "--steps", "--out"]);
if (args.length % 2 || args.some((value, index) => index % 2 === 0 && !allowed.has(value)))
  throw new Error("Unknown or incomplete benchmark option; use --help");
const value = (key, fallback) => {
  const index = args.indexOf(key);
  return index >= 0 ? args[index + 1] : fallback;
};
const endpoint = new URL(process.env.NUVIO_TV_CDP_URL || "http://127.0.0.1:9333");
if (
  !["127.0.0.1", "localhost", "[::1]"].includes(endpoint.hostname) ||
  !["http:", "https:"].includes(endpoint.protocol)
)
  throw new Error("Use a loopback sdb-forwarded CDP endpoint");
const label = value("--case", "baseline");
if (!["baseline", "coalesced", "flat", "webgl", "row", "grid", "decode"].includes(label))
  throw new Error("Unknown benchmark case");
const interval = Number(value("--interval", 200));
if (!Number.isFinite(interval) || interval < 16 || interval > 1000)
  throw new Error("Interval must be16..1000ms");
const steps = String(
  value("--steps", "right,right,right,right,left,left,left,left,down,down,up,up")
).split(",");
const keys = {
  left: ["ArrowLeft", 37],
  right: ["ArrowRight", 39],
  up: ["ArrowUp", 38],
  down: ["ArrowDown", 40]
};
if (!steps.length || steps.length > 100 || steps.some((step) => !keys[step]))
  throw new Error("Use 1..100 arrow steps only");
const out = path.resolve(
  value("--out", "artifacts/q70t-benchmark/" + label + "-" + Date.now() + ".json")
);
const compiled = await build({
  entryPoints: [fileURLToPath(new URL("./dev/q70t-benchmark-browser.js", import.meta.url))],
  bundle: true,
  write: false,
  format: "iife",
  minify: true,
  target: "chrome69"
});
const tabs = await (
  await fetch(new URL("/json", endpoint), { signal: AbortSignal.timeout(5000) })
).json();
const target = tabs.find((tab) => tab.webSocketDebuggerUrl && tab.type === "page");
if (!target) throw new Error("No CDP page; forward and open the TV app manually");
const socketUrl = new URL(target.webSocketDebuggerUrl);
socketUrl.host = endpoint.host;
socketUrl.protocol = endpoint.protocol === "https:" ? "wss:" : "ws:";
const socket = new WebSocket(socketUrl);
await new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error("CDP connect timeout")), 5000);
  socket.onopen = () => {
    clearTimeout(timer);
    resolve();
  };
  socket.onerror = () => {
    clearTimeout(timer);
    reject(new Error("CDP connect failed"));
  };
});
let serial = 0;
const pending = new Map();
socket.onmessage = (event) => {
  const packet = JSON.parse(event.data);
  const request = pending.get(packet.id);
  if (!request) return;
  pending.delete(packet.id);
  clearTimeout(request.timer);
  if (packet.error) request.reject(new Error("CDP command failed"));
  else request.resolve(packet.result);
};
const send = (method, params) =>
  new Promise((resolve, reject) => {
    const id = ++serial;
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error("CDP command timeout"));
    }, 15000);
    pending.set(id, { resolve, reject, timer });
    socket.send(JSON.stringify({ id, method, params }));
  });
const evaluate = async (expression) => {
  const packet = await send("Runtime.evaluate", { expression, returnByValue: true });
  if (packet.exceptionDetails)
    throw new Error("Browser benchmark rejected; check Home/modal state in inspector");
  return packet.result?.value;
};
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let held = null;
try {
  await evaluate(compiled.outputFiles[0].text);
  const initial = await evaluate(
    "window.__NUVIO_Q70T_BENCH__.begin(" + JSON.stringify(label) + ")"
  );
  await pause(700);
  await evaluate("window.__NUVIO_Q70T_BENCH__.reset()");
  for (const step of steps) {
    const [key, keyCode] = keys[step];
    if (held && held !== step) {
      const [oldKey, oldCode] = keys[held];
      await send("Input.dispatchKeyEvent", {
        type: "keyUp",
        key: oldKey,
        code: oldKey,
        windowsVirtualKeyCode: oldCode,
        nativeVirtualKeyCode: oldCode
      });
      held = null;
    }
    await send("Input.dispatchKeyEvent", {
      type: "keyDown",
      key,
      code: key,
      windowsVirtualKeyCode: keyCode,
      nativeVirtualKeyCode: keyCode,
      autoRepeat: held === step
    });
    held = step;
    await pause(interval);
  }
  if (held) {
    const [key, keyCode] = keys[held];
    await send("Input.dispatchKeyEvent", {
      type: "keyUp",
      key,
      code: key,
      windowsVirtualKeyCode: keyCode,
      nativeVirtualKeyCode: keyCode
    });
    held = null;
  }
  await pause(500);
  const result = await evaluate("window.__NUVIO_Q70T_BENCH__.end()");
  await mkdir(path.dirname(out), { recursive: true });
  await writeFile(
    out,
    JSON.stringify(
      { at: new Date().toISOString(), case: label, interval, steps, initial, result },
      null,
      2
    )
  );
  console.log("Benchmark report: " + out);
} finally {
  if (held) {
    const [key, keyCode] = keys[held];
    await send("Input.dispatchKeyEvent", {
      type: "keyUp",
      key,
      code: key,
      windowsVirtualKeyCode: keyCode,
      nativeVirtualKeyCode: keyCode
    }).catch(() => {});
  }
  await evaluate("window.__NUVIO_Q70T_BENCH__ && window.__NUVIO_Q70T_BENCH__.destroy()").catch(
    () => {}
  );
  pending.forEach((request) => {
    clearTimeout(request.timer);
    request.reject(new Error("CDP closed"));
  });
  pending.clear();
  socket.close();
}
