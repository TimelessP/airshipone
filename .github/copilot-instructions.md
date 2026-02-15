# Copilot Instructions for Airship One

These instructions are for AI coding agents working in this repository.

## Current Project Reality (keep this section current)

- This project is in planning/setup stage.
- Primary planning document: [ROADMAP.md](../ROADMAP.md).
- Temporary parity tracker: [LEGACY_PARITY_MAP.md](../LEGACY_PARITY_MAP.md) (delete when parity is complete).
- Legacy/reference code lives under [reference-implementation](../reference-implementation).
- Project-specific contributor skill exists at [skills/airship-one-dev/SKILL.md](./skills/airship-one-dev/SKILL.md) and should be consulted before implementing new slices.
- Project-specific design skill exists at [skills/airship-one-design/SKILL.md](./skills/airship-one-design/SKILL.md) and should be consulted before modifying layout/visual styles.
- Project-specific modular 3D asset skill exists at [skills/airship-one-asset-pipeline/SKILL.md](./skills/airship-one-asset-pipeline/SKILL.md) and should be consulted before creating or modifying module meshes/volumes/textures.
- Release/PWA scaffolding exists (`prod-release.sh`, `scripts/write-version.mjs`, `scripts/build-sw.mjs`, `public/manifest.webmanifest`).
- Convenience shell wrappers exist (`dev-prepare.sh`, `dev-run.sh`, `dev-test.sh`, `dev-build.sh`, `dev-build-bump-ver.sh`) and delegate to npm scripts; `dev-build-bump-ver.sh` bumps version then builds.
- Initial Vite + TypeScript + Three.js runtime scaffold exists (`index.html`, `src/main.ts`, `src/pwa/register-sw.ts`).
- Unified stack-based main menu exists in `src/main.ts` with submenus for Settings/About and local save management (`new`, `resume`, `export JSON`, `import JSON`).
- Menu definition and row-render helper extractions now exist under `src/ui/menu-definitions.ts` and `src/ui/menu-render.ts`; `src/main.ts` remains the orchestration root.
- Battery menu stat/types/format helpers now live in `src/ui/battery-menu.ts` with `src/main.ts` consuming the module.
- Input/gamepad formatting and action-state helpers now live in `src/core/input.ts` and are consumed via thin wrappers in `src/main.ts`.
- Solar geometry and charge-effectiveness helpers now live in `src/render/lighting.ts` and are consumed by simulation/lighting callsites in `src/main.ts`.
- Settings and local simulation state persist to browser local storage and round-trip via exported/imported JSON save envelopes.
- Player pose state now persists in save envelopes (`playerPosition` + `playerYaw`/`playerPitch`) and restores on bootstrap/resume/import.
- Persistent full-width top bar exists in `src/main.ts` (left hamburger menu toggle, centered title, right icon-only system/light/dark switcher).
- Asset pipeline specification exists at [skills/airship-one-asset-pipeline/SKILL.md](./skills/airship-one-asset-pipeline/SKILL.md) and defines module packaging, invisible gameplay volumes, and build-time texel-consistent 1024x1024 atlas mapping.
- Parameter-driven module shell generator exists at `scripts/generate-module-shell.mjs` and writes generated module metadata to `src/content/modules/*.module.json`, including exact module interior profiles (currently `captains-cabin`).
- Runtime module template registration now uses handler files under `src/modules/handlers/*.ts` with centralized registry wiring in `src/modules/registry.ts`; adding/removing a module type is file-based plus registry export wiring.
- `captains_cabin_mk1` is generated via profile and includes authored furnishings (bed, locker, bookshelf with leather-bound books, desk, chair, A4 desk paper) as geometry plus blocked gameplay volumes.
- Ladder room profile variants are now supported (`single`, `lowest`, `middle`, `highest`) with authored `climb` volumes and floor/ceiling hole variants for vertical traversal setups.
- Runtime preview in `src/main.ts` now renders generated module block shells (including corridor window strips) using tile PNG textures from `assets/textures/tiles`.
- Runtime module-join controls now use in-world `+/-` affordances with proximity gating and a center reticle affordance (visual-only, no text hints); insert/remove rebuilds module chain and revalidates player position to nearest occupiable volume.
- Interior module layout now persists independently per ladder floor via `simulation.floorModuleIdsByLevel`; insert/remove operations mutate only the targeted floor chain.
- Ladder floor rendering now aligns ladder center Z across levels; floor add/remove must preserve vertical shaft alignment.
- Floor/module ownership now uses strict explicit level state helpers in `src/main.ts` with no implicit cross-floor module fallback.
- First 3D proximity interactable now exists: the captain's desk A4 paper opens a root-level unified menu letter view with a custom `letter` menu item renderer.
- Electrical simulation now scales effective battery capacity/drain by installed battery-supply module count across all active ladder floors.
- Battery control menu now uses queue-driven, in-place live value bindings with visibility/throttle gating for high-frequency stat events.
- Battery control menu now shows a staged runtime estimate line that labels shared-bus and trailing-battery tail time (`A+B ... then B +tail`).
- Core simulation now carries authoritative ship geo-time state (`shipLatitudeDeg`, `shipLongitudeDeg`, `shipAltitudeAslM`, `shipLocalSolarTimeHours`) derived from real UTC.
- Global scene lighting and solar systems now derive from ship geo-time state (lat/lon/ASL + UTC) and planet parameters (rotation/orbital angle/tilt/distance).
- Runtime now includes a parameterized procedural dynamic sky dome (day/sunset/night gradients + sun-centered coloration + evolving contiguous cloud coverage) synced to UTC sun direction.
- Interaction-opened menus (module insert, captain's paper, battery panel) now default to pointer recapture on close; explicit `Escape` release must cancel pending recapture.
- Tile textures are preloaded before first module/material creation to prevent Three.js `Texture marked for update but no image data found` warnings.
- GitHub Pages base-path-safe asset references are required for menu/static media (e.g., BMAC image uses `import.meta.env.BASE_URL`).
- GitHub Actions Pages workflow scaffold exists (`.github/workflows/build-and-deploy.yml`) using the IdleGames-proven build/upload/deploy pattern.
- Local build/release flow is validated and GitHub Pages is live at `https://timelessp.github.io/airshipone/`; remaining verification is SW update lifecycle, offline installability, and deep-link behavior.

## Product Direction (authoritative)

- Airship One is a **client-side-only** web game.
- Deployment target is **GitHub Pages**.
- Architecture direction is **TypeScript + Vite + modular ECS + typed event queue**.
- Rendering direction is **Three.js** world/interior.
- UI direction is **hybrid**:
  - world/cabin rendered via 320x320 logical pipeline,
  - menus/dialogs are DOM overlays with pixel-style rules.

## Non-Negotiables

- Keep world/navigation math spherical and pole-safe.
- Keep simulation deterministic with fixed-step simulation cadence.
- Keep simulation cadence independent from render cadence.
- Keep expensive terrain/height work on its own scheduler/domain.
- Keep UI state changes flowing through commands/events, not direct arbitrary mutation from view code.

## Before Making Changes

1. Read [ROADMAP.md](../ROADMAP.md) and identify the active phase.
2. Read [skills/airship-one-dev/SKILL.md](./skills/airship-one-dev/SKILL.md) for current workflow/tooling/debug guardrails.
3. Read [skills/airship-one-design/SKILL.md](./skills/airship-one-design/SKILL.md) before changing page composition or typography.
4. Read [skills/airship-one-asset-pipeline/SKILL.md](./skills/airship-one-asset-pipeline/SKILL.md) before changing 3D module geometry, collision/walk volumes, or texture bindings.
5. If parity-related, consult [LEGACY_PARITY_MAP.md](../LEGACY_PARITY_MAP.md).
6. Check reference behavior in [reference-implementation/timelessp-as0](../reference-implementation/timelessp-as0).
7. Make the smallest coherent change that advances the current phase.
8. Update docs/checklists immediately after code changes.

## Development Protocol (When User Says “Implement Next Feature(s)”) 

Treat this as permission to proceed autonomously with the next coherent, scoped implementation slice.

1. **Select next work item**
  - Pick the highest-priority unchecked item from the active section of [ROADMAP.md](../ROADMAP.md).
  - If parity-sensitive, choose the corresponding unchecked row in [LEGACY_PARITY_MAP.md](../LEGACY_PARITY_MAP.md).
  - Prefer vertical slices (one small end-to-end capability) over broad partial scaffolding.

2. **Define the slice boundary**
  - Implement only what is needed to complete one meaningful checkbox or tightly-coupled checkbox cluster.
  - Include required interfaces, events, and wiring for that slice.
  - Avoid speculative expansion outside the chosen slice.

3. **Implement with architecture discipline**
  - Route behavior through typed events/commands.
  - Keep authoritative state in simulation/system modules.
  - Keep UI as a consumer/dispatcher, not a direct mutator of core state.
  - Preserve multi-rate boundaries (`simTick`, `renderTick`, `terrainHarvestTick`, `audioTick`) where relevant.

4. **Verify before handoff**
  - Run focused checks first (typecheck/tests for touched code paths).
  - Add/update tests or acceptance checks for any behavior contract introduced.
  - Confirm no regression in existing touched behavior.

5. **Update tracking docs in same change**
  - Mark completed items in [ROADMAP.md](../ROADMAP.md).
  - Update parity status and notes in [LEGACY_PARITY_MAP.md](../LEGACY_PARITY_MAP.md) when applicable.
  - Keep this instruction file current if conventions or reality changed.

6. **Continue flow by default**
  - After finishing one slice, immediately pick the next eligible roadmap item unless the user redirects.
  - Ask questions only when blocked by ambiguity that materially affects architecture or behavior.
  - If blocked, present one concrete unblock option; do not implement fallback behavior.

### Slice Ordering Heuristics

- Prefer foundational runtime and data contracts before feature polish.
- Prefer dependency order: schema/events → systems → UI wiring → polish.
- Prefer smallest parity-complete increment that is testable.
- Defer non-essential refactors until directly required.

### Definition of Done for Each “Next Feature” Slice

- Behavior implemented and wired end-to-end.
- Types and interfaces in place.
- Verification artifact exists (test or explicit acceptance check).
- Relevant roadmap/parity checkboxes updated.
- No unrelated scope expansion.

## Implementation Rules

- Prefer strongly typed public interfaces.
- Keep modules focused and composable.
- Avoid introducing hidden cross-module coupling.
- Use event-driven boundaries between systems.
- Avoid adding dependencies unless they are justified by roadmap scope.
- Do not introduce backend or server assumptions.
- Fail fast for runtime/debuggability: do not silently swallow exceptions and do not add silent fallback paths that hide defects.
- Early development policy: do not add save/data migrations, do not add fallback execution paths, and do not hide exceptions.
- If handling expected user-input errors, surface explicit, actionable errors instead of masking them.

## Multi-Rate Runtime Rules

When runtime code exists, preserve these boundaries:

- `simTick`: authoritative gameplay/systems updates.
- `renderTick`: view updates and interpolation.
- `terrainHarvestTick`: expensive terrain/mesh jobs with budgeted work slices.
- `audioTick`: decoupled update cadence consuming simulator snapshots.

Never allow terrain harvesting workload to starve simulation updates.

## UI Rules

- Use unified menu patterns from roadmap direction.
- Keep menus/dialogs accessible as real DOM (focusable, keyboard navigable).
- Preserve pixel aesthetic via scale tokens (do not hardcode random per-component stroke widths).
- Pointer-lock semantics are strict: explicit user `Escape` intent to free cursor must not be overridden by delayed auto-recapture.

## Known Runtime Pitfalls

- Ladder level-anchor fallback must compare against level standing eye height (`level * deckHeight + playerEyeHeight`), not deck base Y, otherwise floor add/remove can shift anchor selection and teleport player Z.
- Ladder climb floor-min clamp must be level-relative for lowest/negative levels; using global eye-height causes snap-back when descending to new lower floors.
- Pointer-lock requests can reject with `SecurityError` during unlock races; request paths must handle expected rejection explicitly instead of leaving uncaught promise noise.
- Procedural clouds look artificial when thresholding is too hard; maintain domain warping + edge erosion and sufficient sky dome tessellation to avoid “vector cutout” silhouettes.

## Legacy Translation Rules

For each parity change:

- Identify legacy source behavior precisely.
- Map to new module/system/event in this repo.
- Add or update verification (test or explicit acceptance check).
- Mark parity status in [LEGACY_PARITY_MAP.md](../LEGACY_PARITY_MAP.md).

## What to Update After Each Meaningful Change

- [ROADMAP.md](../ROADMAP.md): checkboxes and scope notes.
- [LEGACY_PARITY_MAP.md](../LEGACY_PARITY_MAP.md): parity row status.
- This file if project reality or conventions changed.

## Out of Scope Unless Explicitly Requested

- Adding backend services.
- Breaking the 320x320 logical render concept.
- Replacing spherical math with planar shortcuts.
- Large refactors not tied to active roadmap phase.

## If You Are Unsure

- Choose the smallest path aligned with current roadmap phase.
- Prefer adding TODO checkboxes and explicit assumptions to roadmap/parity docs rather than guessing hidden requirements.
