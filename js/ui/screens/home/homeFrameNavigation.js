// Frame-coalescing concept: SamSUCKS input.js (GPL-3.0); see docs/SAMSUCKS-ATTRIBUTION.md.
// Only opt-in Home held-direction events use this queue; OK/Back/player are never delayed.
export function createHomeFrameNavigation(dispatch, isActive) {
  let pending = null;
  let frame = null;
  let timer = null;
  const cancel = () => {
    if (frame !== null) cancelAnimationFrame(frame);
    if (timer !== null) clearTimeout(timer);
    frame = timer = null;
    pending = null;
  };
  const flush = () => {
    const event = pending;
    cancel();
    if (event && isActive()) dispatch({ ...event, homeFrameFlushed: true });
  };
  return {
    queue(event) {
      pending = event;
      if (frame !== null) return;
      frame = requestAnimationFrame(flush);
      timer = setTimeout(flush, 50);
    },
    flush,
    cancel
  };
}
