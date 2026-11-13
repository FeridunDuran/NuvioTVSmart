import { Router } from "./routerState.js";
import { focusWithoutScroll } from "./focusWithoutScroll.js";
import { Platform } from "../../platform/index.js";

// Hold detection must use when the key was pressed/released, not when a busy main thread got to the
// event: a late keyup would otherwise turn a short OK press into a long press (Android uses key events too).
// Personal build: press duration for hold menus (title options, episode menus).
// Samsung Tizen 5.5 stamps key events at ~1 s resolution (every keydown/keyup on a Q70T
// ended in ...523 ms), so a short OK press crossing that boundary measured 1000 ms and
// opened the hold menu. Plain wall-clock time is inflated when the UI thread stalls and the
// keyup is handled late. Duration is therefore measured on a monotonic clock and only up to
// the last heartbeat the UI thread managed to run while the key was down: time spent stalled
// right before the keyup was handled is not counted as holding.
const HOLD_HEARTBEAT_MS = 50;
const HOLD_STALL_GAP_MS = 150;

function monotonicNow() {
  return typeof performance !== "undefined" && typeof performance.now === "function"
    ? performance.now()
    : Date.now();
}

function measuredHoldDuration(started) {
  const now = monotonicNow();
  const lastBeatAt = Number(started.lastBeatAt || started.at);
  const releasedAt = now - lastBeatAt > HOLD_STALL_GAP_MS ? lastBeatAt : now;
  return Math.max(0, releasedAt - Number(started.at || releasedAt));
}

function buildNormalizedEvent(event) {
  const normalizedKey = Platform.normalizeKey(event);
  const normalizedCode = Number(normalizedKey.keyCode || 0);

  return {
    key: normalizedKey.key,
    code: normalizedKey.code,
    keyName: normalizedKey.keyName,
    target: event?.target || null,
    altKey: Boolean(event?.altKey),
    ctrlKey: Boolean(event?.ctrlKey),
    shiftKey: Boolean(event?.shiftKey),
    metaKey: Boolean(event?.metaKey),
    repeat: Boolean(event?.repeat),
    defaultPrevented: Boolean(event?.defaultPrevented),
    keyCode: normalizedCode,
    which: normalizedCode,
    originalKeyCode: Number(normalizedKey.originalKeyCode || event?.keyCode || 0),
    keyDownDurationMs: 0,
    preventDefault: () => {
      if (typeof event?.preventDefault === "function") {
        event.preventDefault();
      }
    },
    stopPropagation: () => {
      if (typeof event?.stopPropagation === "function") {
        event.stopPropagation();
      }
    },
    stopImmediatePropagation: () => {
      if (typeof event?.stopImmediatePropagation === "function") {
        event.stopImmediatePropagation();
      }
    }
  };
}

function hasActiveModal() {
  return Boolean(globalThis?.document?.body?.classList?.contains("nuvio-modal-open"));
}

const BACK_DEBOUNCE_MS = 250;

export const FocusEngine = {
  lastBackHandledAt: 0,
  lastPointerFocusTarget: null,
  pointerMoveFrame: null,
  pendingPointerMoveEvent: null,
  activeKeyDownStartedAt: new Map(),
  keyHoldHeartbeat: null,

  startKeyHoldHeartbeat() {
    if (this.keyHoldHeartbeat) {
      return;
    }
    this.keyHoldHeartbeat = setInterval(() => {
      if (!this.activeKeyDownStartedAt.size) {
        this.stopKeyHoldHeartbeat();
        return;
      }
      const now = monotonicNow();
      this.activeKeyDownStartedAt.forEach((entry) => {
        // A beat after a long gap means the thread was stalled; keep the gap uncounted.
        if (now - Number(entry.lastBeatAt || entry.at) <= HOLD_STALL_GAP_MS) {
          entry.lastBeatAt = now;
        } else {
          entry.at += now - Number(entry.lastBeatAt || entry.at) - HOLD_HEARTBEAT_MS;
          entry.lastBeatAt = now;
        }
      });
    }, HOLD_HEARTBEAT_MS);
  },

  stopKeyHoldHeartbeat() {
    if (this.keyHoldHeartbeat) {
      clearInterval(this.keyHoldHeartbeat);
      this.keyHoldHeartbeat = null;
    }
  },
  activeBackKeyIdentities: new Set(),

  init() {
    this.boundHandleKey = this.handleKey.bind(this);
    this.boundHandleKeyUp = this.handleKeyUp.bind(this);
    this.boundHandlePointerMove = this.handlePointerMove.bind(this);
    this.boundHandlePointerClick = this.handlePointerClick.bind(this);
    document.addEventListener("keydown", this.boundHandleKey, true);
    document.addEventListener("keyup", this.boundHandleKeyUp, true);
    if (Platform.isWebOS()) {
      document.addEventListener("mousemove", this.boundHandlePointerMove, true);
      document.addEventListener("pointermove", this.boundHandlePointerMove, true);
      document.addEventListener("click", this.boundHandlePointerClick, true);
      document.documentElement?.classList?.add("webos-pointer-remote");
      document.body?.classList?.add("webos-pointer-remote");
    }
  },

  handleBack(event, normalizedEvent = buildNormalizedEvent(event)) {
    const now = Date.now();
    const elapsedSinceHandled = now - Number(this.lastBackHandledAt || 0);
    if (normalizedEvent.repeat || elapsedSinceHandled < BACK_DEBOUNCE_MS) {
      normalizedEvent.preventDefault();
      normalizedEvent.stopPropagation();
      normalizedEvent.stopImmediatePropagation();
      Router.consumeRouteReturnBackGuard?.();
      return;
    }
    this.lastBackHandledAt = now;

    normalizedEvent.preventDefault();
    normalizedEvent.stopPropagation();
    normalizedEvent.stopImmediatePropagation();

    if (Router.consumeRouteReturnBackGuard?.({ freshPress: true })) {
      return;
    }

    const currentScreen = Router.getCurrentScreen();
    const consumeResult = currentScreen?.consumeBackRequest?.();
    if (consumeResult) {
      if (consumeResult === "history") {
        return;
      }
      Router.suppressNextPopstate?.();
      return;
    }

    if (hasActiveModal()) {
      Router.suppressNextPopstate?.();
      return;
    }

    Router.back();
  },

  handleKey(event) {
    if (event?.target && !document.contains(event.target)) {
      return;
    }

    if (hasActiveModal()) {
      return;
    }

    const normalizedEvent = buildNormalizedEvent(event);
    const keyIdentity = this.getKeyIdentity(normalizedEvent);
    if (keyIdentity && (!normalizedEvent.repeat || !this.activeKeyDownStartedAt.has(keyIdentity))) {
      const at = monotonicNow();
      this.activeKeyDownStartedAt.set(keyIdentity, { at, lastBeatAt: at });
      this.startKeyHoldHeartbeat();
    }

    if (
      Platform.isBackEvent({
        target: normalizedEvent.target,
        key: normalizedEvent.key,
        code: normalizedEvent.code,
        keyName: normalizedEvent.keyName,
        keyCode: normalizedEvent.keyCode,
        originalKeyCode: normalizedEvent.originalKeyCode
      })
    ) {
      // Samsung TV delivers the mandatory Back key through keydown/keyup. A
      // held remote key can emit another keydown after the 250 ms timing
      // debounce, while the first Player -> Sources transition is still
      // mounting. Treat one keydown/keyup cycle as one Android-style Back
      // action; a later press is released first and therefore remains valid.
      // Samsung exposes the mandatory TV Back key through a few equivalent
      // DOM representations (10009, 461, Back, XF86Back). They are one
      // Android-style action, not separate keys. Canonicalize them before the
      // key-cycle latch so an alias change cannot navigate a second route.
      const backKeyIdentity = "back";
      if (this.activeBackKeyIdentities.has(backKeyIdentity)) {
        normalizedEvent.preventDefault();
        normalizedEvent.stopPropagation();
        normalizedEvent.stopImmediatePropagation();
        Router.consumeRouteReturnBackGuard?.();
        return;
      }
      this.activeBackKeyIdentities.add(backKeyIdentity);
      this.handleBack(event, normalizedEvent);
      return;
    }

    const currentScreen = Router.getCurrentScreen();

    if (currentScreen?.onKeyDown) {
      Promise.resolve(currentScreen.onKeyDown(normalizedEvent)).catch((error) => {
        console.warn("Screen keydown handler failed", error);
      });
    }
  },

  handleKeyUp(event) {
    const normalizedEvent = buildNormalizedEvent(event);
    const keyIdentity = this.getKeyIdentity(normalizedEvent);
    if (
      Platform.isBackEvent({
        target: normalizedEvent.target,
        key: normalizedEvent.key,
        code: normalizedEvent.code,
        keyName: normalizedEvent.keyName,
        keyCode: normalizedEvent.keyCode,
        originalKeyCode: normalizedEvent.originalKeyCode
      })
    ) {
      this.activeBackKeyIdentities.delete("back");
    }
    if (event?.target && !document.contains(event.target)) return;
    if (hasActiveModal()) {
      if (keyIdentity) {
        this.activeKeyDownStartedAt.delete(keyIdentity);
      }
      return;
    }

    if (keyIdentity) {
      const started = this.activeKeyDownStartedAt.get(keyIdentity);
      normalizedEvent.keyDownDurationMs = started ? measuredHoldDuration(started) : 0;
      this.activeKeyDownStartedAt.delete(keyIdentity);
      if (!this.activeKeyDownStartedAt.size) {
        this.stopKeyHoldHeartbeat();
      }
    }

    const currentScreen = Router.getCurrentScreen();
    if (!currentScreen?.onKeyUp) {
      return;
    }
    Promise.resolve(currentScreen.onKeyUp(normalizedEvent)).catch((error) => {
      console.warn("Screen keyup handler failed", error);
    });
  },

  getKeyIdentity(event) {
    if (Platform.isBackEvent(event)) {
      return "back";
    }
    const keyCode = Number(event?.keyCode || event?.which || 0);
    if (keyCode) {
      return `code:${keyCode}`;
    }
    const key = String(event?.key || event?.code || event?.keyName || "").trim();
    return key ? `key:${key}` : "";
  },

  getPointerFocusable(event) {
    const target =
      event?.target?.closest?.(".focusable") ||
      event?.target?.closest?.(
        "button, [role='button'], a[href], input, textarea, select, [data-action], [data-action-id]"
      );
    if (!target || !(target instanceof HTMLElement) || !document.contains(target)) {
      return null;
    }
    if (
      target.disabled ||
      target.classList.contains("is-disabled") ||
      target.classList.contains("disabled") ||
      target.getAttribute("aria-disabled") === "true"
    ) {
      return null;
    }
    const rect = target.getBoundingClientRect?.();
    if (!rect || rect.width <= 0 || rect.height <= 0) {
      return null;
    }
    return target;
  },

  focusPointerTarget(target, event = null) {
    if (!target) {
      return false;
    }
    if (hasActiveModal() && !target.closest?.(".nuvio-dialog-backdrop")) {
      return false;
    }
    const currentScreen = Router.getCurrentScreen();
    const screenContainer =
      currentScreen?.container instanceof HTMLElement
        ? currentScreen.container
        : target.closest(".screen");
    if (screenContainer && !screenContainer.contains(target)) {
      return false;
    }

    const focusRoot = screenContainer || document;
    focusRoot.querySelectorAll?.(".focused")?.forEach((node) => {
      if (node !== target) {
        node.classList.remove("focused");
      }
    });
    target.classList.add("focused");
    focusWithoutScroll(target);
    currentScreen?.onPointerFocus?.(target, event);
    this.lastPointerFocusTarget = target;
    return true;
  },

  handlePointerMove(event) {
    if (!Platform.isWebOS()) {
      return;
    }
    this.pendingPointerMoveEvent = event;
    if (this.pointerMoveFrame) {
      return;
    }
    const run = () => {
      this.pointerMoveFrame = null;
      const pendingEvent = this.pendingPointerMoveEvent;
      this.pendingPointerMoveEvent = null;
      this.processPointerMove(pendingEvent);
    };
    if (typeof requestAnimationFrame === "function") {
      this.pointerMoveFrame = requestAnimationFrame(run);
    } else {
      this.pointerMoveFrame = setTimeout(run, 16);
    }
  },

  processPointerMove(event) {
    if (!Platform.isWebOS()) {
      return;
    }
    const currentScreen = Router.getCurrentScreen();
    currentScreen?.onPointerMove?.(event);
    const target = this.getPointerFocusable(event);
    const activeElement = document.activeElement;
    // Hover must not end an editing session while the Magic Remote travels
    // toward the system keyboard. Explicit clicks and D-pad navigation still
    // move focus through their existing handlers.
    if (
      activeElement !== target &&
      activeElement?.matches?.(
        "input:not([type]), input[type='text'], input[type='search'], input[type='email'], input[type='password'], input[type='url'], input[type='tel'], input[type='number'], textarea"
      ) &&
      !activeElement.disabled &&
      !activeElement.readOnly
    ) {
      return;
    }
    if (!target || target === this.lastPointerFocusTarget) {
      return;
    }
    if (hasActiveModal() && !target.closest?.(".nuvio-dialog-backdrop")) {
      return;
    }
    this.focusPointerTarget(target, event);
  },

  handlePointerClick(event) {
    if (!Platform.isWebOS()) {
      return;
    }
    const target = this.getPointerFocusable(event);
    const currentScreen = Router.getCurrentScreen();
    if (!target) {
      const handled = currentScreen?.onPointerSurfaceActivate?.(event?.target, event);
      if (handled && typeof handled.then === "function") {
        event?.preventDefault?.();
        event?.stopPropagation?.();
        event?.stopImmediatePropagation?.();
        handled.catch((error) => console.warn("Screen pointer surface handler failed", error));
      } else if (handled) {
        event?.preventDefault?.();
        event?.stopPropagation?.();
        event?.stopImmediatePropagation?.();
      }
      return;
    }
    if (hasActiveModal() && !target.closest?.(".nuvio-dialog-backdrop")) {
      return;
    }
    this.focusPointerTarget(target, event);
    if (hasActiveModal()) {
      return;
    }
    if (typeof currentScreen?.onPointerActivate !== "function") {
      return;
    }
    const handled = currentScreen.onPointerActivate(target, event);
    if (handled && typeof handled.then === "function") {
      event?.preventDefault?.();
      event?.stopPropagation?.();
      event?.stopImmediatePropagation?.();
      handled.catch((error) => console.warn("Screen pointer activation failed", error));
      return;
    }
    if (handled) {
      event?.preventDefault?.();
      event?.stopPropagation?.();
      event?.stopImmediatePropagation?.();
    }
  }
};
