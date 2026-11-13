import { Platform } from "../../platform/index.js";
import { getTvRuntimePerformanceProfile } from "../../platform/tvRuntimePerformance.js";

// Runtime-only A/B controls. No credentials, URLs or persistent user settings.
// Set __NUVIO_Q70T_PLAYBACK__ before opening a stream; delete it to restore defaults.
export function q70tPlaybackPolicy() {
  const profile = getTvRuntimePerformanceProfile();
  const enabled = Platform.isTizen() && profile.chromiumMajorVersion > 0 && profile.chromiumMajorVersion <= 69;
  const overrides = globalThis.__NUVIO_Q70T_PLAYBACK__ || {};
  const buffers = { memory: 15, balanced: 30, original: 50 };
  const bufferProfile = Object.prototype.hasOwnProperty.call(buffers, overrides.bufferProfile) ? overrides.bufferProfile : "balanced";
  const hlsEngine = ["auto", "avplay", "hls.js"].includes(overrides.hlsEngine) ? overrides.hlsEngine : "auto";
  return { enabled, bufferProfile, hlsBufferSeconds: enabled ? buffers[bufferProfile] : 50, hlsEngine };
}

export function sourceVideoHeight(candidate = {}) {
  for (const value of [
    candidate.videoHeight,
    candidate.height,
    candidate.resolution,
    candidate.quality,
    candidate.behaviorHints?.videoHeight
  ]) {
    if (typeof value === "number" && Number.isFinite(value) && value >= 144 && value <= 4320) return value;
    const text = String(value || "").trim();
    const dimensions = text.match(/^\d{3,5}\s*[x×]\s*(\d{3,4})$/i);
    const height = dimensions ? Number(dimensions[1]) : Number(text.match(/^(\d{3,4})p$/i)?.[1] || 0);
    if (height >= 144 && height <= 4320) return height;
    if (/^(4k|uhd)$/i.test(text)) return 2160;
  }
  return 0;
}

export function preferQ70tAvplay(height = 0) {
  const policy = q70tPlaybackPolicy();
  return policy.enabled && (policy.hlsEngine === "avplay" || (policy.hlsEngine === "auto" && Number(height) > 1080));
}
