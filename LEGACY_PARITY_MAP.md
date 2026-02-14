# Airship One — Legacy Parity Map (Temporary)

> Temporary working document for implementation parity tracking.
> Delete this file once feature parity is complete and verified.

## Purpose

Track legacy Airship Zero behavior and map it to Airship One modules, events, and tests.

For each row:
- Legacy source defines the behavior contract.
- New implementation target identifies where behavior belongs in Airship One.
- Verification defines the artifact required before marking complete.

## Status Legend

- [ ] Not started
- [~] In progress
- [x] Parity reached
- [!] Intentional divergence (documented)

---

## Runtime Cadence Parity

| Status | Legacy contract | New target | Verification |
|---|---|---|---|
| [ ] | Single loop in `main.py` with `clock.tick(60)`, scene update + render each frame | `src/core/scheduler/*` multi-rate domains: `simTick`, `renderTick`, `terrainHarvestTick`, `audioTick` | Determinism test: same sim result under different render FPS |
| [ ] | Simulator updates via `CoreSimulator.update(real_dt)` | `src/sim/sim-loop.ts` fixed-step `simTick` at 25 Hz | Sim drift test over 10 min equivalent runtime |
| [ ] | Expensive terrain generation mixed into scene rendering paths | `src/render/terrain/jobs/*` time-sliced `terrainHarvestTick` | Budget test: terrain jobs never starve `simTick` |

---

## State Schema Parity

| Status | Legacy contract | New target | Verification |
|---|---|---|---|
| [ ] | `gameInfo` fields: version, created, lastSaved, totalFlightTime, sessionTime, paused | `src/save/schema/game-info.ts` | Save/load roundtrip snapshot diff |
| [ ] | `settings` includes update-check and sound volume keys | `src/save/schema/settings.ts` | Migration test with missing keys |
| [ ] | `navigation` includes position, motion, controls, targets, mode, autopilot, route, mapView | `src/sim/navigation/*` + `src/save/schema/navigation.ts` | Contract test for required keys |
| [ ] | `engine` includes controls + pressure/temp/fuel-flow fields | `src/sim/engine/*` + `src/save/schema/engine.ts` | Engine step test vectors |
| [ ] | `electrical` includes two batteries + alternator + loads | `src/sim/electrical/*` | Battery depletion/charge tests |
| [ ] | `fuel` two tanks (forward/aft) with feed, transfer, dump rates | `src/sim/fuel/*` | Fuel transfer and feed-cut tests |
| [ ] | `cargo` includes winch, hold/bay, crate types, CoG, refresh flags | `src/sim/cargo/*` + `src/save/schema/cargo.ts` | Placement + CoG integration tests |
| [ ] | `environment` weather + time fields | `src/sim/environment/*` | Time progression and weather drift tests |
| [ ] | `systems` warnings/alerts/failures arrays | `src/sim/monitoring/*` | Warning threshold tests |
| [ ] | `library` order/in_game_books/bookmarks | `src/sim/library/*` + `src/save/schema/library.ts` | Library order + bookmark persistence tests |

---

## Navigation / Geodesy Parity

| Status | Legacy contract | New target | Verification |
|---|---|---|---|
| [ ] | Lat/lon wrap and pole reflection logic from `core_simulator.py` and `tests/test_latlon_wrap.py` | `src/math/geodesy/wrap.ts` | Ported parity tests from legacy cases |
| [ ] | Waypoint bearing via forward azimuth | `src/math/geodesy/bearing.ts` | Numeric comparison against legacy outputs |
| [ ] | Waypoint distance via haversine (NM) | `src/math/geodesy/distance.ts` | Known-route fixtures |
| [ ] | Navigation map view persisted: zoom + offsets | `src/ui/navigation-map/*` + save schema | View persistence scenario test |
| [ ] | Range ring correctness on sphere | `src/render/overlays/range-rings.ts` | Polar and antimeridian visual tests |

---

## Wind / Flight Dynamics Parity

| Status | Legacy contract | New target | Verification |
|---|---|---|---|
| [ ] | Altitude-banded wind behavior and smooth transitions | `src/sim/environment/wind.ts` | Dynamic wind table parity tests |
| [ ] | Ground speed from vector sum of airspeed and wind vectors | `src/sim/navigation/ground-speed.ts` | Physics vector assertion tests |
| [ ] | Altitude clamp against terrain/sea level with hard-landing consequences | `src/sim/navigation/altitude-constraints.ts` | Landing edge-case scenarios |

---

## Engine / Electrical / Fuel Parity

| Status | Legacy contract | New target | Verification |
|---|---|---|---|
| [ ] | Mixture and altitude affect power/RPM/manifold/EGT | `src/sim/engine/model.ts` | Engine response curve tests |
| [ ] | Engine fuel starvation impacts RPM/fuel flow/pressure | `src/sim/engine/fuel-coupling.ts` | Feed-cut scenario tests |
| [ ] | Alternator online by RPM, battery charge/discharge behavior | `src/sim/electrical/model.ts` | Charge-discharge cycle tests |
| [ ] | Two-tank transfer/dump/feed and imbalance penalties | `src/sim/fuel/model.ts` | Transfer and imbalance tests |

---

## Cargo Parity

| Status | Legacy contract | New target | Verification |
|---|---|---|---|
| [ ] | Winch rail movement + cable extension + attached crate follow | `src/sim/cargo/winch.ts` | Hold-input integration test |
| [ ] | Loading bay disabled/cleared when moving under power | `src/sim/cargo/loading-bay.ts` | Motion threshold tests |
| [ ] | Grid bounds + AABB collision + support-under-corners detach rule | `src/sim/cargo/placement.ts` | Placement regression suite |
| [ ] | Crate actions: transfer fuel, repair engine, add to library | `src/sim/cargo/crate-actions.ts` | Per-action effect tests |
| [ ] | Cargo hold affects CoG and total weight | `src/sim/cargo/mass-properties.ts` | CoG calculation tests |

---

## Library / Book / Edit Parity

| Status | Legacy contract | New target | Verification |
|---|---|---|---|
| [ ] | Merge user books with in-game books while preserving order | `src/sim/library/catalog.ts` | Catalog merge and order tests |
| [ ] | Markdown paging and image handling in book reader | `src/ui/book-reader/*` | Reader rendering parity checks |
| [ ] | Bookmark add/get/remove persistence | `src/sim/library/bookmarks.ts` | Bookmark persistence tests |
| [ ] | Move in-game book to cargo crate and back to library | `src/sim/library-logistics/*` | End-to-end logistics scenario |

---

## Scene / UI Interaction Parity

| Status | Legacy contract | New target | Verification |
|---|---|---|---|
| [ ] | Tab/Shift+Tab focus cycling in menu-style controls | `src/ui/focus/*` | Keyboard focus integration tests |
| [ ] | Hold semantics for winch and slider actions | `src/input/hold-actions.ts` | Input duration tests |
| [ ] | ESC semantics differ by context (close mode vs leave scene/menu) | `src/ui/context-routing.ts` | Context routing tests |
| [ ] | Navigation map click/drag/right-click behaviors | `src/ui/navigation-map/interactions.ts` | Interaction regression tests |

---

## Terrain / Observatory Parity

| Status | Legacy contract | New target | Verification |
|---|---|---|---|
| [ ] | Multi-tier LOD terrain mesh strategy | `src/render/terrain/lod.ts` | LOD transition visual tests |
| [ ] | Frustum culling and near-plane safety | `src/render/terrain/culling.ts` | No artifact stress tests |
| [ ] | Mesh cache and invalidation thresholds | `src/render/terrain/cache.ts` | Cache hit/miss telemetry checks |
| [ ] | Observatory camera rotate/tilt controls with heading-relative view | `src/render/observatory/*` | Camera behavior parity tests |

---

## Persistence / Migration Parity

| Status | Legacy contract | New target | Verification |
|---|---|---|---|
| [~] | Save/load existence checks and game resume semantics | `src/main.ts` (temporary runtime save envelope + resume flow) | Resume flow E2E tests |
| [ ] | Legacy migration for `library` old format | `src/save/migrations/library-v1.ts` | Migration fixture tests |
| [ ] | Settings-based update-check timestamps | `src/save/schema/settings.ts` | Settings migration tests |

---

## PWA / Offline Parity

| Status | Legacy contract | New target | Verification |
|---|---|---|---|
| [x] | App version exposed to runtime from build metadata | `package.json` + `public/version.js` (generated by `scripts/write-version.mjs`) | `prod-release.sh` output includes package version and generated version module |
| [x] | Service worker generated from template with versioned cache namespace | `scripts/sw.template.js` + `scripts/build-sw.mjs` | Built `sw.js` contains cache name `AirshipOne-v<package_version>` |
| [x] | Precache list supports static offline boot path | `scripts/build-sw.mjs` (`dist` scan + prepare-only fallback) | `sw.js` includes `./index.html`, `./manifest.webmanifest`, and `./version.js` |
| [~] | Client registration/update flow and skip-waiting handshake | `src/pwa/register-sw.ts` | Browser integration test: update prompts/applies cleanly |
| [~] | Manifest metadata and app install behavior on static host | `public/manifest.webmanifest` + app icons (planned) | Installability check in Chromium-based browser |
| [ ] | Offline navigation fallback under GitHub Pages-style paths | service worker fetch handler + Pages path tests | Manual/automated offline route checks |

---

## Notes (Current, not future)

- This repository currently has planning docs and reference implementation sources.
- Airship One now has initial Vite + TypeScript runtime scaffolding and PWA release tooling.
- Mark items only when code + tests exist in this repository.
