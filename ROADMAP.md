# Airship One — ROADMAP

A step-by-step implementation roadmap for rebuilding Airship Zero as a brand-new, client-side web simulator.

## Vision

Create a single-player airship simulator that is technically robust, mathematically correct on a sphere, and deeply enjoyable through emergent systems: flying, navigation, logistics, comfort, reading, and ship stewardship.

## Non-Negotiables

- [ ] Client-side only runtime (no backend requirement)
- [ ] Ready to deploy on GitHub Pages
- [ ] TypeScript-first modular architecture
- [ ] Lightweight custom ECS + typed event queue
- [ ] Three.js world/interior rendering
- [ ] 320x320 logical world render target (offscreen), scaled to viewport
- [ ] Hybrid UI: DOM overlays for menus/dialogs, pixel aesthetic preserved
- [x] Unified menu system pattern (data-driven, stack-based, keep-open behaviors)
- [ ] Offline-ready PWA (manifest + service worker + deterministic cache versioning)
- [~] Deterministic simulation cadence target at 25 FPS with delta-time support
- [ ] Simulation, render, and terrain-harvest run on separate schedulers (multi-rate)
- [ ] Spherical navigation correctness (including poles and longitude wrap)
- [ ] Range rings and route math based on spherical calculations (no shortcuts)

## Technical Baseline

- [ ] Runtime: modern evergreen browsers
- [ ] Build tool: Vite
- [ ] Language: TypeScript (strict mode)
- [ ] 3D engine: Three.js
- [ ] State model: ECS world + system modules + serialized game state
- [x] Persistence: `localStorage` save slots + import/export JSON
- [ ] Packaging: static assets and bundle suitable for GitHub Pages
- [ ] Development environment baseline: Linux primary; Windows contributors use VS Code Git Bash-compatible shell flow

## Legacy Translation Coverage (Airship Zero → Airship One)

### Source Scope (painstaking extraction targets)
- [ ] Core state + simulation contracts from `core_simulator.py`
  - [ ] Initial schema coverage: `gameInfo`, `settings`, `navigation`, `engine`, `electrical`, `fuel`, `cargo`, `environment`, `systems`, `library`
  - [ ] Runtime updates coverage: `_update_wind_field`, `_update_engine`, `_update_navigation`, `_update_autopilot`, `_update_fuel_system`, `_update_electrical_system`, `_update_environment`, `_update_systems_monitoring`, `_update_cargo_system`
  - [ ] Persistence/migration coverage: `save_game`, `load_game`, settings/update-check migration behavior
- [ ] App loop + scene orchestration contracts from `main.py`
  - [ ] 320x320 logical surface and scale/letterbox behavior
  - [ ] Mouse coordinate conversion into logical space
  - [~] Scene transition semantics (`new_game`, `resume_game`, scene dict transitions)
  - [ ] Simulation pause/resume policy by scene type
- [ ] Scene UX contracts from `scene_*.py`
  - [ ] Main menu enable/disable/focus rules
  - [ ] Bridge/nav/fuel/cargo keyboard + hold semantics
  - [ ] Library/book/edit workflows and ordering/bookmark behavior
  - [ ] Observatory controls and 3D/2D fallback expectations
- [ ] Terrain/math contracts from `terrain_mesh.py`, `heightmap.py`, and tests
  - [ ] Multi-tier LOD, frustum behavior, near-plane handling, and cache policy
  - [ ] Heightmap lat/lon sampling and calibration assumptions
  - [ ] Pole/longitude wrap behavior from `tests/test_latlon_wrap.py`
  - [ ] Dynamic wind band behavior from `tests/dynamic_wind_table.py`

### Translation Rule (for every legacy requirement)
- [ ] For each requirement, record all three layers:
  - [ ] Legacy behavior (what Airship Zero does now)
  - [ ] Airship One architecture mapping (ECS components/systems/events)
  - [ ] Verification artifact (test, debug overlay, or acceptance scenario)

---

## Phase 0 — Project Foundation & Delivery Pipeline

### 0.1 Repository and Tooling
- [x] Initialize Vite + TypeScript project structure
- [x] Configure strict TypeScript settings (`strict`, `noUncheckedIndexedAccess`, etc.)
- [x] Add ESLint + Prettier configuration
- [x] Add npm scripts (`dev`, `build`, `preview`, `typecheck`, `lint`)
- [~] Add deterministic version metadata strategy in app (semver + build timestamp)
- [x] Add bundled royalty-free typography (sans + monospace + script) to build output
- [x] Establish rem-based text sizing baseline with 24-row rhythm and style-based emphasis rules
- [x] Add dynamic text scale recalculation on viewport resize
- [x] Add tokenized Victorian light/dark theme palette (wood, paper, green/red velvet)

### 0.1.a Developer Bootstrap Scripts (Fast Onboarding)
- [x] Add `dev-prepare.sh` as the primary setup command for contributors
  - [ ] Detect OS and shell capabilities (Linux/macOS/Git Bash/WSL)
  - [x] Check/install prerequisites guidance (Node + npm/pnpm choice)
  - [x] Install dependencies and run initial verification (`typecheck` + smoke test)
  - [ ] Create local env defaults if missing (non-secret template files only)
  - [ ] Print next-step commands clearly (`dev-run.sh`, `dev-test.sh`, `dev-build.sh`)
- [x] Add `dev-run.sh` for local development launch
  - [x] Start the local dev server using project-standard tooling (Vite)
  - [x] Include preflight checks with friendly remediation messages
  - [x] Support common run modes (default dev server, optional host/port passthrough)
- [x] Add `dev-test.sh` for local validation workflow
  - [x] Run lint + typecheck + unit/integration tests in stable order
  - [x] Fail fast with actionable output
  - [x] Support quick mode (focused checks) and full mode (CI-equivalent)
- [x] Add `dev-build.sh` for production-ready local build
  - [x] Run clean build pipeline and output artifact location
  - [x] Verify static hosting assumptions for GitHub Pages (`base` path sanity)
  - [ ] Optionally run lightweight post-build smoke checks
- [x] Add `dev-build-bump-ver.sh` to bump package version patch segment from shell workflow
- [x] Keep shell scripts as the primary cross-platform interface (Linux/macOS + VS Code Git Bash on Windows)
- [ ] Add optional Windows wrappers only if needed, ensuring wrappers delegate to the `.sh` source-of-truth scripts

### 0.1.b Release + Version + PWA Build Pipeline
- [x] Add `prod-release.sh` as the production packaging entrypoint
  - [x] Validate required toolchain (`node`, `npm`) and repository prerequisites
  - [x] Use `package.json` version as source-of-truth for release metadata
  - [x] Run deterministic install/build flow and emit explicit artifact path
- [x] Add runtime-readable version artifact generation
  - [x] Generate `public/version.js` from `package.json` during build
  - [x] Keep generated file behavior deterministic and overwrite-safe
- [x] Add offline-first PWA delivery artifacts
  - [x] Include `public/manifest.webmanifest` with standalone app settings
  - [x] Generate service worker from a template with versioned cache name
  - [x] Build pre-cache list from production output when `dist/` exists
  - [x] Provide prepare-only fallback for pre-scaffold phases (writes `public/sw.js`)
- [x] Add update and cache lifecycle expectations
  - [x] Service worker activation clears old cache versions
  - [x] Navigation requests have offline fallback behavior
  - [x] Static assets prefer network with cache fallback

### 0.2 GitHub Pages Readiness
- [x] Configure Vite `base` for repository path deployment
- [x] Add GitHub Actions workflow for build and deploy to Pages
- [ ] Add SPA routing fallback strategy compatible with static hosting
- [~] Validate asset paths work from both local dev and Pages URL
- [x] Set canonical deployed homepage URL metadata (`https://timelessp.github.io/airshipone/`)

### 0.2.a Pending Post-Deploy Validation (After first GitHub Pages release)
- [~] Run production smoke test on live GitHub Pages URL
  - [~] Confirm app shell loads without console errors on first visit
  - [x] Confirm `dist/version.js` value matches released `package.json` version
  - [x] Confirm `sw.js` cache name reflects released package version
- [ ] Validate offline/PWA behavior on deployed origin
  - [ ] Installability check (manifest + standalone launch)
  - [ ] Offline refresh of app shell succeeds after first online visit
  - [ ] Update path check: bump version, redeploy, and verify service-worker-controlled refresh to new assets
- [ ] Validate GitHub Pages path behavior
  - [ ] Deep-link and reload behavior under repository subpath
  - [ ] Asset URL integrity under Pages base path

### 0.3 Core Documentation
- [ ] Add `README.md` for setup, run, and deployment
- [ ] Add architecture overview section (ECS, events, rendering, UI layers)
- [ ] Add contribution guidelines and code style expectations
- [ ] Link this roadmap from the README
- [ ] Keep `.github/copilot-instructions.md` current with project reality and conventions
- [ ] Keep temporary `LEGACY_PARITY_MAP.md` current until parity completion, then remove it

### Exit Criteria
- [ ] Fresh clone can run dev server and produce a deployable Pages artifact
- [~] CI build is green for lint + typecheck + build
- [~] Fresh clone setup completes via `dev-prepare.sh` with no manual fixups on Linux/macOS
- [ ] Windows contributors can run equivalent bootstrap/run/test/build via VS Code Git Bash shell path
- [x] `dev-run.sh`, `dev-test.sh`, and `dev-build.sh` are deterministic and match CI intent
- [x] `prod-release.sh` produces versioned release assets and service worker output
- [ ] PWA installability and offline behavior are validated in a static hosting context

---

## Phase 1 — Architecture Skeleton (Modular ECS + Event Queue)

### 1.1 Folder Topology
- [ ] `src/core/` (app bootstrap, game loop, timing)
- [ ] `src/ecs/` (entity/component/system primitives)
- [ ] `src/events/` (typed events, queue, dispatcher)
- [ ] `src/sim/` (domain systems: nav, power, fuel, cargo, crew)
- [ ] `src/render/` (three.js world, cabin, post-scale)
- [ ] `src/ui/` (DOM overlays, unified menus, input mapping)
- [ ] `src/content/` (books, static tables, definitions)
- [ ] `src/save/` (serialization, migration, slots)
- [ ] `src/math/` (geodesy, spherical ops, utility)

### 1.2 ECS Core
- [ ] Define entity ID strategy and creation/destruction lifecycle
- [ ] Define component registration and storage patterns
- [ ] Define system update ordering and dependencies
- [ ] Add debug introspection hooks (entity counts, system timings)

### 1.3 Typed Event Queue
- [ ] Define event envelope (`type`, timestamp, payload, source)
- [~] Create strongly typed event map for compile-time payload safety
- [~] Implement queue push/pop and bounded capacity behavior
- [~] Implement deterministic per-tick dispatch ordering
- [ ] Add event tracing mode for debugging/replay

### 1.4 App Loop
- [~] Implement fixed-step sim loop targeting 25 FPS
- [~] Implement accumulator pattern with max catch-up cap
- [~] Keep render decoupled from sim step
- [ ] Track delta-time metrics and frame pacing diagnostics

### 1.5 Multi-Rate Timing Architecture (Required)
- [ ] Split runtime into independent timing domains
  - [ ] `simTick` domain (authoritative systems): target 25 FPS fixed step
  - [ ] `renderTick` domain (visual update): adaptive (display-driven, capped)
  - [ ] `terrainHarvestTick` domain (expensive globe/height jobs): lower fixed rate with budget guard
  - [ ] `audioTick` domain: decoupled from visual render, pull from simulator snapshot
- [ ] Add domain scheduler contracts
  - [ ] Each domain has explicit max CPU budget per second
  - [ ] Backpressure policy when terrain harvest overruns (`skip`, `defer`, `coarsen LOD`)
  - [ ] Inter-domain communication via typed event queues + immutable snapshots
- [ ] Add per-domain telemetry
  - [ ] Effective Hz, jitter, frame drops, queue lag, and overrun counters
  - [ ] On-screen perf HUD toggle for debugging
- [ ] Add correctness constraints
  - [ ] Simulation results must be independent of render FPS
  - [ ] Terrain harvest cadence must not alter physics determinism
  - [ ] Input sampled at render/UI cadence but applied at sim boundary

### Exit Criteria
- [ ] ECS world updates deterministic demo entities each tick
- [ ] Event queue can drive cross-system actions without direct coupling

---

## Phase 2 — Rendering Core (320x320 Target + Scale Pipeline)

### 2.1 Render Pipeline
- [ ] Create offscreen 320x320 logical render target for world/cabin
- [ ] Scale output to fit viewport while preserving aspect ratio
- [ ] Preserve nearest-neighbor visual style for final blit
- [ ] Handle letterboxing and window resize events

### 2.2 Three.js Scene Foundation
- [x] Initialize renderer, scene, camera(s), and lighting baseline
- [x] Add parameterized procedural sky dome synced to UTC sun direction (day/sunset/night gradients + contiguous evolving cloud field)
- [ ] Define world scene and cabin scene boundaries
- [ ] Add camera controller abstraction (external flight view + interior view)

### 2.3 Performance and Stability Baseline
- [ ] Add frustum culling checks for generated geometry
- [ ] Add near-plane safety rules to avoid projection instability
- [ ] Add profiling panel for draw calls, frame time, memory snapshots

### Exit Criteria
- [ ] World render remains stable under camera movement and resizes
- [ ] 320x320-to-viewport output is visually consistent across DPI scales

---

## Phase 3 — Globe, Terrain, and Geodesy (Cloth-on-Sphere)

### 3.1 Spherical Math Package
- [ ] Implement robust lat/lon normalization and wrap logic
- [ ] Implement pole-safe heading behavior
- [ ] Implement great-circle distance and initial/final bearings
- [ ] Implement destination point solver on sphere
- [ ] Implement cross-track and along-track error metrics

### 3.2 Terrain Representation
- [ ] Define cloth-on-sphere mesh strategy and update cadence
- [ ] Implement multi-tier LOD bands for near/mid/far terrain
- [ ] Sample height data in spherical coordinates
- [ ] Add atmospheric fade and distance cues

### 3.5 Terrain Harvest Pipeline (Legacy-Informed)
- [ ] Translate expensive mesh generation into staged jobs
  - [ ] Height sample acquisition (lat/lon→elevation)
  - [ ] Triangle generation per LOD ring
  - [ ] Color/biome sampling from map texture
  - [ ] Frustum/visibility prefilter pass
- [ ] Implement terrain cache policy inspired by legacy mesh cache
  - [ ] Cache keying by geo cell + altitude band
  - [ ] Invalidation threshold by moved distance
  - [ ] Independent sun/lighting cache with slower refresh window
- [ ] Enforce near-plane and clipping safety
  - [ ] No vertex projection behind near plane
  - [ ] Stable fallback when clipped triangle data is incomplete
  - [ ] Guard rails against extreme screen-coordinate artifacts
- [ ] Place terrain harvesting on `terrainHarvestTick`
  - [ ] Configurable target Hz separate from sim/render
  - [ ] Time-sliced work queue per frame budget
  - [ ] Graceful degradation path: reduce resolution tiers before dropping sim FPS

### 3.3 Navigation Overlays
- [ ] Implement geodesic range rings centered on ship
- [ ] Ensure ring spacing is physically meaningful and configurable
- [ ] Render route arcs as great-circle segments (not planar lines)
- [ ] Validate behavior near poles and antimeridian crossings

### 3.4 Validation Harness
- [ ] Add deterministic geodesy test vectors
- [ ] Add edge-case tests for poles and longitude discontinuities
- [ ] Add visual debug overlays for route and ring correctness

### Exit Criteria
- [ ] Navigation math passes known spherical test cases
- [ ] Range rings and routes remain accurate and stable globally

---

## Phase 4 — Airship Structure and Walkable Gondola Interior

### 4.1 Interior Topology
- [ ] Define gondola as sealed, walkable long-box interior
- [ ] Implement room/corridor graph and door connectivity
- [ ] Implement collision boundaries and navigation mesh/grid for player movement

### 4.1.a Modular Interior Asset Pipeline
- [x] Add formal module/volume/texture pipeline specification (`.github/skills/airship-one-asset-pipeline/SKILL.md`)
- [ ] Define `module.v1` metadata schema contract in runtime loader
- [x] Define module slot graph rules (fixed `cockpit` front, fixed `cargo` rear, dynamic middle modules)
- [x] Implement insert/remove module command validation (`+`/`-` wall controls near corridor doorway)
- [ ] Implement build-time texture atlas generator contract (`1024x1024` pages + manifest)
- [ ] Enforce texel density target across all interior surfaces
- [ ] Add asset validation checks (connector compatibility, traversable corridor, invalid volume overlaps)

### 4.1.b Invisible Gameplay Volumes
- [ ] Standardize volume primitives (`box`, `capsule`, `convex`) for module metadata
- [~] Integrate `walkable`/`blocked`/`climb`/`headBump`/`doorway` query pipeline
- [~] Add jump head-hit and ladder traversal checks against authored volumes
- [ ] Add doorway transition triggers from authored `doorway` volumes

### 4.1.c Authoring Workflow (User + Copilot)
- [x] Add dedicated skill for module authoring process (`.github/skills/airship-one-asset-pipeline/SKILL.md`)
- [x] Add first module template package under runtime content path (`src/content/modules/captains_cabin_mk1.module.json`)
- [x] Add parameter-driven module shell generator (`scripts/generate-module-shell.mjs`) with `room/open/cockpit/cargo` profiles
- [x] Use parameterized generator as source-of-truth for exact module variants via interior profiles (`auto|none|captains-cabin|battery-room`)
- [x] Add captain's cabin furnishing profile generation (bed, locker, bookshelf + leather-bound books, desk, chair, A4 desk paper)
- [x] Add battery room furnishing profile generation (battery boxes + wall control panel)
- [x] Add ladder room profile generation variants (single/lowest/middle/highest with floor/ceiling-hole options)
- [x] Add in-world join controls (`+` insert, `-` remove) with fixed-module removal guards
- [x] Add proximity-gated join control visibility with center reticle interaction hint
- [x] Add nearest-walkable player relocation when module-chain changes produce invalid occupancy
- [x] Persist and edit independent module chains per ladder floor (`floorModuleIdsByLevel`) to prevent cross-floor mutation coupling
- [x] Enforce strict floor/module helper usage with explicit level ownership (no implicit cross-floor fallback)
- [x] Align ladder module center Z across floors to keep vertical shafts aligned after floor insert/remove
- [x] Add file-based runtime module handler registry (`src/modules/handlers/*.ts` + `src/modules/registry.ts`) for add/remove module type workflows
- [ ] Add texture request checklist and acceptance gates to contributor docs

### 4.2 Player Locomotion
- [ ] Implement first/third-person interior movement controls
- [~] Add interaction targeting for station hotspots
  - [x] First proximity-gated hotspot interaction implemented: captain's desk A4 paper opens unified letter menu
  - [x] Battery room control panel hotspot opens root-level battery control menu
  - [x] Interaction-opened menus now recapture pointer lock on close by default, while explicit `Escape` keeps cursor released
- [ ] Add context prompts for interactable stations

### 4.3 Station Anchors
- [ ] Define station metadata schema (`id`, room, system binding, interaction UI)
- [ ] Spawn and render station anchor points in gondola
- [ ] Route station interactions through event queue

### Exit Criteria
- [ ] Player can traverse entire gondola interior
- [ ] Every station anchor can be reached and interacted with
- [ ] Interior module insert/remove operations preserve traversable corridor and deterministic simulation state
- [ ] All interior module surfaces satisfy texel density contract via build-time atlas mapping

---

## Phase 5 — Input Abstraction (Mouse, Touch, Keyboard, Gamepad/HID)

### 5.1 Input Device Layer
- [ ] Create unified input abstraction over keyboard/mouse/touch/gamepad
- [ ] Add action map (rebindable command IDs)
- [ ] Add per-device deadzone/repeat handling

### 5.2 Interaction Routing
- [ ] Route input to active context (world vs menu vs dialog)
- [ ] Preserve proper focus semantics for DOM controls
- [ ] Prevent double-handling between gameplay and open menus

### 5.4 Legacy Input Semantics Translation
- [ ] Preserve hold-based interactions from legacy scenes
  - [ ] Winch movement hold behavior (left/right/up/down)
  - [ ] Slider drag + keyboard incremental adjustment behavior
  - [ ] Distinct press vs hold semantics for action buttons
- [ ] Preserve legacy focus model expectations
  - [ ] Tab / Shift+Tab cyclic traversal rules
  - [ ] Escape semantics (`close editor mode` vs `leave scene/menu`)
  - [ ] Enter/Space activation parity for focused controls
- [ ] Preserve map interaction behavior from navigation scene
  - [ ] Drag-to-pan and click-to-place waypoint distinction
  - [ ] Right-click near waypoint to clear
  - [ ] Zoom and center controls with persisted view settings

### 5.3 Accessibility & Usability
- [ ] Ensure tab order and focus indicators for all menus/dialogs
- [ ] Add keyboard-only parity for station operations
- [ ] Provide clear input hints per active device

### Exit Criteria
- [ ] All core interactions are playable with keyboard and gamepad
- [ ] No input leaks when menus/dialogs are active

---

## Phase 6 — Unified Menu System (DOM Overlay, Pixel Style)

### 6.1 Unified Menu Architecture
- [x] Implement data-driven `MENUS` registry and handler map
- [x] Implement stack-based navigation (root replace, submenu push)
- [x] Implement behavior attributes (`keep-open`, `back`, `submenu`, `close`, `close-all`)
- [x] Implement in-place value refresh for setting rows
- [ ] Implement full in-place rebuild when list structure changes

### 6.2 Menu Component Coverage
- [x] Setting rows with inline actions
- [x] Action rows with danger/disabled states
- [x] Divider and section rows
- [ ] Table rows with per-cell action buttons
- [~] Specialized feed/log rows (for social/comms-style content)
  - [x] Custom non-standard row implemented: structured `letter` item renderer for captains-letter menu

### 6.3 Pixel-Accurate DOM Styling System
- [ ] Define root scale token (`--pixel-scale`)
- [ ] Define derived unit token (`--px`) from scale
- [ ] Derive all border/outline thickness from `--px`
- [ ] Derive spacing, radius, and shadow offsets from `--px`
- [ ] Derive font sizing/line height from scale tokens
- [ ] Enforce 8px-style logical grid alignment via tokenized spacing
- [ ] Validate crispness and stroke consistency across DPI/zoom levels

### 6.4 Overlay/Canvas Harmony
- [ ] Keep menus/dialogs as true DOM overlays (not DOM-to-canvas rasterized UI)
- [ ] Keep world rendering in 320x320 canvas pipeline
- [ ] Ensure overlay alignment tracks viewport and letterbox safely

### Exit Criteria
- [ ] Menus are non-blocking while simulation continues
- [ ] Pixel aesthetic remains consistent at multiple viewport scales

---

## Phase 7 — Core Ship Systems (Feature Parity Baseline)

### 7.1 Navigation & Flight
- [ ] Ship state: position, heading, speed, altitude, vertical speed
- [ ] Route planning and waypoint management
- [ ] Autopilot holds (heading, altitude, speed) with tolerances
- [ ] Wind influence and drift model hooks

#### 7.1.a Legacy-to-New Requirements (from `core_simulator.py` + `scene_navigation.py`)
- [ ] Position and heading update rules
  - [ ] Apply heading from turn-rate driven by rudder authority
  - [ ] Derive TAS from IAS and density factor
  - [ ] Derive GS from vector sum of airspeed and wind vectors
- [ ] Global wrap correctness
  - [ ] Latitude pole reflection with heading inversion across poles
  - [ ] Longitude wrap to canonical range
  - [ ] Surface height lookup after wrap normalization
- [ ] Waypoint behavior
  - [ ] Single active waypoint baseline support
  - [ ] Great-circle bearing and haversine distance outputs
  - [ ] Route-follow mode heading target sourcing from waypoint bearing
- [ ] Navigation map view state
  - [ ] Persist zoom/offset in save schema
  - [ ] Apply bounds checking on load and interaction updates

### 7.2 Engine, Power, and Life Support
- [ ] Engine state machine and throttle model
- [ ] Power generation/load distribution model
- [ ] Oxygen, heat, food, morale baseline loops
- [ ] Incident triggers and resolution hooks

#### 7.2.a Legacy-to-New Requirements (from `core_simulator.py`)
- [ ] Engine-fuel coupling
  - [ ] Engine output degrades under low/zero fuel pressure
  - [ ] RPM and manifold respond to throttle/mixture/propeller and altitude
  - [ ] Automatic engine shutdown path when RPM collapses
- [ ] Thermal and pressure monitoring
  - [ ] Oil temp/pressure, CHT, EGT trend behavior
  - [ ] Mixture-dependent EGT behavior and warning thresholds
- [ ] Electrical behavior
  - [ ] Alternator online behavior tied to RPM
  - [ ] Battery charge/discharge with voltage droop model
  - [ ] Load-driven warnings for low battery states

### 7.3 Fuel System
- [ ] Fuel tank states and consumption logic
- [ ] Fuel transfer operations and constraints
- [ ] Fuel UI station interactions and status displays

#### 7.3.a Legacy-to-New Requirements (from `core_simulator.py` + `scene_fuel.py`)
- [ ] Two-tank model
  - [ ] `forward` and `aft` tank capacities, levels, and feed toggles
  - [ ] Transfer rates per tank (outbound to opposite tank)
  - [ ] Dump rates per tank (overboard loss)
- [ ] Consumption and balance effects
  - [ ] Engine feed cut logic if no active feed tank
  - [ ] Fuel flow consumption split across feeding tanks
  - [ ] Pitch/drag penalties from tank imbalance
- [ ] Station control semantics
  - [ ] Toggle + vertical slider controls (mouse drag + keyboard step)
  - [ ] Immediate simulator command dispatch from UI actions
  - [ ] Disabled/guarded actions when constraints are not met

### 7.4 Cargo System
- [ ] Cargo hold + loading bay area rules
- [ ] Winch movement/attach/detach mechanics
- [ ] Grid placement, collision, support/stability checks
- [ ] Weight + center-of-gravity impact on ship behavior
- [ ] Cargo use actions (fuel drums, supplies, etc.)

#### 7.4.a Legacy-to-New Requirements (from `core_simulator.py` + `scene_cargo.py`)
- [ ] Dual-area cargo model
  - [ ] Distinct `cargoHold` vs `loadingBay` behavior and constraints
  - [ ] Loading bay refresh lockout while ship is moving under power
  - [ ] Auto-clear loading bay under motion conditions
- [ ] Winch mechanics
  - [ ] Rail-constrained hook X motion + cable-length bounds
  - [ ] Attached crate follows hook with grid snap
  - [ ] Attach/detach with placement validity checks
- [ ] Placement physics
  - [ ] Area bounds checks per crate dimensions
  - [ ] AABB collision blocking and support-under-corners rule
  - [ ] Settling/drop computation before detach acceptance
- [ ] Crate actions and side effects
  - [ ] Fuel transfer, library add, engine repair, consumables usage
  - [ ] Remove-on-use behavior when action succeeds
  - [ ] Cargo hold only contributes to weight/center-of-gravity

### 7.5 Crew & Automation
- [ ] Crew roster model and role assignment
- [ ] Shift/duty cycle state machine
- [ ] Basic autonomous tasking per role
- [ ] Crew transfer in/out interactions

#### 7.5.a Legacy-to-New Requirements (current source coverage)
- [ ] Preserve currently implemented baseline while designing full expansion
  - [ ] Keep architecture hooks for roles/automation in ECS now
  - [ ] Reserve event contracts for future crew duty simulation layers
  - [ ] Add parity checklist items as soon as corresponding legacy scene/source is imported

### 7.6 Library/Books & Comfort Systems
- [ ] Book inventory and reading UI
- [ ] In-ship leisure interactions (comfort ambiance hooks)
- [ ] Journal/log surface for emergent narrative moments

#### 7.6.a Legacy-to-New Requirements (from `scene_library.py`, `scene_book.py`, `scene_edit.py`, `core_simulator.py`)
- [ ] Library inventory model
  - [ ] Merge in-game books with user books while preserving user-defined order
  - [ ] Persist order and in-game presence with migration-safe schema
  - [ ] Maintain bookmark storage per book identifier
- [ ] Reading experience
  - [ ] Markdown parsing (headings/basic emphasis/image blocks)
  - [ ] Pagination and reflow on font/layout changes
  - [ ] Cached image loading with cleanup on exit
- [ ] Editing and logistics
  - [ ] Editable user books flow and save-back behavior
  - [ ] Move-to-cargo operation for in-game books (book crate generation)
  - [ ] Add-to-library action from book crates

### 7.7 Observatory & External View Translation
- [ ] Preserve observatory capabilities from `scene_observatory.py`
  - [ ] Horizon/world view with heading-relative camera controls
  - [ ] View rotation + tilt constraints
  - [ ] Fallback mode strategy when terrain assets are unavailable
- [ ] Integrate with new Three.js pipeline
  - [ ] Separate camera rig for observatory mode
  - [ ] Terrain mesh render path with profile-controlled quality tiers
  - [ ] Sun/time overlays tied to sim environment clock

### Exit Criteria
- [ ] Baseline systems can be operated through stations end-to-end
- [ ] System loops produce emergent tradeoffs without hard scripting

---

## Phase 8 — Save/Load, Settings, and Data Integrity

### 8.1 Save Model
- [ ] Define canonical serialized game schema
- [ ] Add schema versioning + migration pipeline
- [ ] Add save slot metadata (name, timestamp, playtime)

#### 8.1.a Legacy Migration Requirements
- [ ] Migrate legacy save semantics safely
  - [ ] Navigation map view (`zoomLevel`, `offsetX`, `offsetY`)
  - [ ] Library migration from old `books[]` to ordered refs + in-game tracking
  - [ ] Cargo/winch attached-crate compatibility paths
- [ ] Maintain compatibility guarantees
  - [ ] Unknown fields preserved when possible
  - [ ] Missing sections reconstructed with defaults
  - [ ] Migration tests for representative historical save samples

### 8.2 Import/Export
- [ ] JSON export with validation
- [ ] JSON import with robust error messaging
- [ ] Recovery path for malformed/partial saves

### 8.3 Settings
- [ ] Unit conversion settings (imperial/metric/mixed) at presentation layer
- [ ] Input settings and rebinding persistence
- [ ] Graphics/performance presets

### Exit Criteria
- [ ] Save files are forward-migratable between roadmap milestones
- [ ] Import/export round-trips without data loss

---

## Phase 9 — Emergent Behavior Layer and Content Expansion

### 9.1 Emergent Systems Tuning
- [ ] Balance resource loops for meaningful decisions
- [ ] Increase cross-system dependencies (e.g., cargo ↔ power ↔ route)
- [ ] Add soft-failure cascades with recoverable interventions

### 9.2 Dynamic Events
- [ ] Add anomaly/event framework tied to location and ship state
- [ ] Add probabilistic event generation with cooldown controls
- [ ] Add station-specific response options

### 9.3 Content Authoring Pipeline
- [ ] Define externalized content schema (books, contracts, locations)
- [ ] Add validation tooling for content packs
- [ ] Add localization-ready string strategy

### Exit Criteria
- [ ] Gameplay sessions produce varied, meaningful outcomes
- [ ] Content can be expanded without engine refactors

---

## Phase 10 — QA, Optimization, Accessibility, and Release

### 10.1 Testing Strategy
- [ ] Unit tests for math, ECS utilities, and serialization
- [ ] Integration tests for menu flows and station interactions
- [ ] Regression tests for pole-crossing and antimeridian behavior

#### 10.1.a Legacy-Derived Regression Pack
- [ ] Lat/lon wrap regression cases from `tests/test_latlon_wrap.py`
- [ ] Wind-band behavior validation derived from `tests/dynamic_wind_table.py`
- [ ] Cargo placement/support/refresh behavior parity scenarios
- [ ] Waypoint bearing/distance numerical accuracy checks

### 10.2 Performance Targets
- [ ] Maintain stable simulation at target tick cadence
- [ ] Reduce frame spikes from terrain/cabin updates
- [ ] Add budgets for draw calls and CPU time per system

#### 10.2.a Multi-FPS Targets (Hard Requirements)
- [ ] `simTick` target: 25 Hz fixed, 99th percentile jitter bound defined
- [ ] `renderTick` target: display-adaptive, with cap and fallback floor
- [ ] `terrainHarvestTick` target: configurable lower Hz (initially 4–10 Hz budgeted)
- [ ] Frame budget policy: terrain work must yield before threatening sim deadlines
- [ ] Telemetry gates in CI/dev profile to catch cadence regressions

### 10.3 Accessibility
- [ ] Keyboard-first complete gameplay path
- [ ] Color contrast and focus indicator checks
- [ ] Optional reduced motion for UI transitions

### 10.4 Release Readiness
- [ ] Build reproducibility documented
- [ ] Changelog and release notes process
- [ ] First public GitHub Pages milestone release

### Exit Criteria
- [ ] Playable, stable milestone build published on GitHub Pages
- [ ] Critical test suites green and documented

---

## Cross-Cutting Standards (Apply to Every Phase)

### Code Quality
- [ ] Strong typing for all public module boundaries
- [ ] No hidden side effects between systems (event queue first)
- [ ] Keep modules small and purpose-specific

### Simulation Discipline
- [ ] Keep authoritative state in simulation layer
- [ ] UI never mutates state directly; dispatches commands/events
- [ ] Deterministic behavior preferred for core simulation paths

### Math Integrity
- [ ] Prefer spherical solutions over planar approximations
- [ ] Explicitly test edge cases: poles, wraps, tiny distances, long routes

### UX Discipline
- [ ] Unified menu behavior consistency across stations
- [ ] Minimal friction for common station operations
- [ ] Delightful details in presentation without sacrificing clarity

---

## Milestone Sequence Summary

- [ ] M0 Foundation + Pages pipeline
- [ ] M1 ECS/event architecture skeleton
- [ ] M2 Render core and 320x320 scaling pipeline
- [ ] M3 Cloth-on-sphere terrain + global navigation math
- [ ] M4 Walkable gondola and stations
- [ ] M5 Input abstraction across devices
- [ ] M6 Unified DOM menus with pixel-accurate styling tokens
- [ ] M7 Core ship systems parity baseline
- [ ] M8 Save/load/settings/data migrations
- [ ] M9 Emergent behaviors + content expansion
- [ ] M10 QA/performance/accessibility/release

---

## Immediate Next Actions (Now)

- [ ] Approve this roadmap scope and milestone order
- [x] Implement developer bootstrap scripts (`dev-prepare.sh`, `dev-run.sh`, `dev-test.sh`, `dev-build.sh`) for Linux-first and Git Bash-compatible workflows
- [x] Scaffold Vite + TypeScript project in repo root
- [x] Implement `dev-build-bump-ver.sh` to bump package version and run production build
- [x] Add project-specific implementation skill at `.github/skills/airship-one-dev/SKILL.md`
- [x] Add project-specific design skill at `.github/skills/airship-one-design/SKILL.md`
- [x] Fix current rendering regression where the visible square/canvas grows continuously at runtime
- [x] Add System/Light/Dark tri-switcher with SVG iconography and persisted preference
- [x] Add initial folder architecture (`core`, `ecs`, `events`, `render`, `ui`, `sim`, `math`, `save`)
- [ ] Implement first thin vertical slice:
  - [ ] 25 FPS fixed-step loop
  - [ ] typed event queue
  - [x] 320x320 render target scaled to viewport
  - [x] one station interaction opening unified menu overlay
- [ ] Publish first internal preview build
