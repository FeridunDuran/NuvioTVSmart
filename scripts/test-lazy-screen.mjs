import assert from "node:assert/strict";
import test from "node:test";
import { createLazyScreen } from "../js/ui/navigation/lazyScreen.js";
test("large screen setup is deferred and its stable route object owns state", async () => {
  let loads = 0;
  const screen = createLazyScreen(async () => {
    loads++;
    return {
      Player: {
        mount(value) {
          this.value = value;
        },
        cleanup() {
          this.value = null;
        },
        onKeyDown() {
          return this.value;
        }
      }
    };
  }, "Player");
  assert.equal(loads, 0);
  await screen.mount("one");
  assert.equal(loads, 1);
  assert.equal(screen.onKeyDown(), "one");
  await screen.mount("two");
  assert.equal(loads, 1);
  assert.equal(screen.value, "two");
});
test("leaving a route before its deferred module arrives prevents a stale mount", async () => {
  let finish,
    mounts = 0;
  const screen = createLazyScreen(() => new Promise((resolve) => (finish = resolve)), "Screen");
  const pending = screen.mount();
  await Promise.resolve();
  screen.cleanup();
  finish({
    Screen: {
      mount() {
        mounts++;
      }
    }
  });
  await pending;
  assert.equal(mounts, 0);
});
