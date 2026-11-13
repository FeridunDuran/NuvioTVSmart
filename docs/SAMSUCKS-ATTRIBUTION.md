# SamSUCKS reference attribution

Reference: https://github.com/rfaile313/samsucks

Inspected revision: `6b00e926e163a3154dd1993a26b47482d61ebf40` (read on2026-11-13). License: GNU General Public License version3, as supplied in the reference repository; preserved at `docs/licenses/SamSUCKS-GPL-3.0.txt`.

Referenced files: `app/js/input.js`, `app/js/ui/row.js`, `app/js/ui/grid.js`, `app/js/ui/images.js`, `app/js/ui/backdrop.js`, `app/js/dev/remote.js`, `tools/devserver.mjs`.

The Nuvio adaptation uses frame-coalescing for optional Home held-direction input; bounded recycled row/grid and priority/decode image experiments; and a2x2 WebGL corner-color experiment. The implementations are adapted to Nuvio's lifecycle and developer tooling. No Plex code, media service configuration, remote eval server or Tizen6.5 package configuration is imported.

New adaptation files: `js/ui/screens/home/homeFrameNavigation.js`, `scripts/dev/q70t-recycled-pilot.js`, `scripts/dev/q70t-benchmark-browser.js`, `scripts/q70t-benchmark.mjs`. Nuvio's repository license remains in `LICENSE`. Reference performance numbers belong to the reference author's device and are not Nuvio/Q70T benchmark results.
