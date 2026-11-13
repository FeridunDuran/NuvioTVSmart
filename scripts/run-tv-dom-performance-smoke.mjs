import assert from "node:assert/strict";
import { build } from "esbuild";
import { fileURLToPath } from "node:url";
const endpoint = process.env.NUVIO_TV_CDP_URL || "http://127.0.0.1:9333";
const result = await build({
  entryPoints: [fileURLToPath(new URL("./tv-dom-performance-smoke.mjs", import.meta.url))],
  bundle: true,
  write: false,
  format: "iife",
  target: "chrome69",
  minify: true
});
const tabs = await (await fetch(`${endpoint}/json`)).json();
assert.ok(tabs[0]?.webSocketDebuggerUrl, "No debug target; forward the TV debug port first");
const ws = new WebSocket(tabs[0].webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  ws.onopen = resolve;
  ws.onerror = reject;
});
try {
  const packet = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("TV DOM smoke timed out")), 20000);
    ws.onmessage = (e) => {
      const data = JSON.parse(e.data);
      if (data.id === 1) {
        clearTimeout(timer);
        resolve(data);
      }
    };
    ws.send(
      JSON.stringify({
        id: 1,
        method: "Runtime.evaluate",
        params: {
          expression: result.outputFiles[0].text + ";globalThis.__nuvioDomPerfSmoke;",
          returnByValue: true
        }
      })
    );
  });
  assert.ok(!packet.error, JSON.stringify(packet.error));
  assert.ok(!packet.result.exceptionDetails, JSON.stringify(packet.result.exceptionDetails));
  const smoke = packet.result.result.value;
  assert.equal(smoke.passed, true);
  console.log(`TV DOM smoke passed: ${smoke.checks} checks`);
} finally {
  ws.close();
}
