# Nuvio TV Turbo (Samsung Tizen fork)

A personal fork of [NuvioMedia/NuvioWeb](https://github.com/NuvioMedia/NuvioWeb), the Nuvio smart TV web app for Samsung Tizen and LG webOS.

**Goal:** the same lean, remote-friendly Nuvio on an older Samsung TV as on my Android TV, with fewer distractions and a source list that favours what the TV can actually play well.

**Target TV:** Samsung QE55Q70TATXTK (Q70T, 2020), Tizen 5.5, 32-bit ARM. Sister project for a Philips QM163E Android TV: [NuvioTV fork](https://github.com/FeridunDuran/NuvioTV).

This is not an official Nuvio build. All credit for the app goes to the Nuvio team; see the upstream repository for the full documentation, installer and support links.

## What is different from upstream

| Area        | Change                                                                                                                                                                         |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Updates     | The in-app update check is off; the fork is installed by hand.                                                                                                                 |
| Source list | Inside each provider: 1080p first, then 720p, then 4K, then the rest. Inside a tier the most seeded torrent comes first. Streams without a seed count keep the add-on's order. |
| Source list | Add-on promo rows ("Support project", "Join Discord", "Add to liked" and similar) are hidden.                                                                                  |
| Subtitles   | Add-on subtitles are fetched only after playback has started (20 s at most), so they do not compete with video startup.                                                        |
| Player      | The focused control shows its name under the icon.                                                                                                                             |

Changes live on the `turbo` branch. `main` tracks upstream.

## Platform notes for Tizen 5.5

- Torrent playback works through the bundled local EngineFS service; no external server is needed.
- The Nuvio plugin system is unavailable below Tizen 6 (upstream limitation: the TV's service runtime is Node 4.4.3). Regular add-ons are unaffected.

## Build

```bash
npm ci
npm run package:tizen
```

Requires a `local.properties` (see `local.example.properties`); it is not committed. The package is an unsigned development WGT and must be signed for the target TV before installation.

## Status

Built and packaged; not yet verified on the TV.

## License

Same license as upstream; see [LICENSE](LICENSE).
