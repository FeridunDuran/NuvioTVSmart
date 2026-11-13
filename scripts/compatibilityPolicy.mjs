// Personal fork: Samsung Q70T (2020), Tizen 5.5 / Chromium 69.
// Service runtimes have their own Node targets; never use this browser target for them.
export const compatibilityPolicy = Object.freeze({
  buildProfile: "q70t-tizen55",
  tizenSupportYear: 2020,
  webOsSupportYear: 2020,
  webOsRequiredVersion: "5.0.0",
  tizenInstallMinimumVersion: "5.5",
  tizenRequiredVersion: "5.5",
  chromiumVersion: 69,
  webOsChromiumVersion: 68,
  webOsServiceNodeVersion: 8,
  includeTizenPluginService: false
});
