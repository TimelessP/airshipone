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
- Settings and local simulation state persist to browser local storage and round-trip via exported/imported JSON save envelopes.
- Persistent full-width top bar exists in `src/main.ts` (left hamburger menu toggle, centered title, right icon-only system/light/dark switcher).
- Asset pipeline specification exists at [skills/airship-one-asset-pipeline/SKILL.md](./skills/airship-one-asset-pipeline/SKILL.md) and defines module packaging, invisible gameplay volumes, and build-time texel-consistent 1024x1024 atlas mapping.
- Parameter-driven module shell generator exists at `scripts/generate-module-shell.mjs` and writes generated module metadata to `src/content/modules/*.module.json`.
- Runtime preview in `src/main.ts` now renders generated module block shells (including corridor window strips) using tile PNG textures from `assets/textures/tiles`.
- Runtime module-join controls now use in-world `+/-` affordances with proximity gating and a center reticle hint; insert/remove rebuilds module chain and revalidates player position to nearest occupiable volume.
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
  - If blocked, present one concrete unblock option and one fallback path.

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
