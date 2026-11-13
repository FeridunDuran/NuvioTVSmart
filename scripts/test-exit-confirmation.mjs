import assert from "node:assert/strict";
import test from "node:test";
import { installExitConfirmation } from "../js/ui/components/exitConfirmation.js";

function setup() {
  const target = new EventTarget();
  target.body = {};
  target.activeElement = { isConnected: true };
  let dialogCount = 0,
    exits = 0,
    restores = 0,
    config;
  const requestExit = () => {
    const e = new Event("nuvio:beforeExitApp", { cancelable: true });
    target.dispatchEvent(e);
    if (!e.defaultPrevented) exits++;
    return e;
  };
  const uninstall = installExitConfirmation({
    target,
    exit: requestExit,
    translate: (_key, fallback) => fallback,
    restoreFocus: () => restores++,
    createDialog: (options) => {
      config = options;
      dialogCount++;
      return {
        mount() {},
        destroy({ afterExit } = {}) {
          afterExit?.();
        }
      };
    }
  });
  return {
    requestExit,
    uninstall,
    config: () => config,
    exits: () => exits,
    restores: () => restores,
    dialogs: () => dialogCount
  };
}
test("exit requests show one confirmation with Cancel first; repeated Back cannot exit", () => {
  const h = setup();
  assert.equal(h.requestExit().defaultPrevented, true);
  h.requestExit();
  assert.equal(h.dialogs(), 1);
  assert.equal(h.exits(), 0);
  assert.equal(h.config().buttons[0].key, "cancel");
  h.uninstall();
});
test("Cancel and dialog Back dismissal keep the app open and restore focus", () => {
  const h = setup();
  h.requestExit();
  h.config().buttons[0].onAction();
  assert.equal(h.exits(), 0);
  assert.equal(h.restores(), 1);
  h.requestExit();
  h.config().onDismiss();
  assert.equal(h.exits(), 0);
  assert.equal(h.restores(), 2);
  h.uninstall();
});
test("only explicit Exit closes the app; confirmation does not recursively prompt", () => {
  const h = setup();
  h.requestExit();
  h.config().buttons[1].onAction();
  assert.equal(h.exits(), 1);
  assert.equal(h.dialogs(), 1);
  h.uninstall();
});
