---
name: airship-one-dev
description: Airship One implementation playbook for runtime architecture, npm-first tooling, release/PWA flow, and debugging checks.
---

# Airship One Dev Skill

Use this skill for day-to-day implementation in this repository.

## Purpose

Keep contributors aligned on:
- runtime architecture direction,
- npm-first developer tooling,
- release/PWA versioning flow,
- practical debugging checks before and after changes.

## Current Stack and Source of Truth

- Runtime: TypeScript + Vite + Three.js.
- Deployment target: GitHub Pages.
- Architecture target: modular ECS + typed event queue + multi-rate update domains.
- Version source of truth: `package.json` `version`.
- Theme model: runtime light/dark mode with tokenized Victorian wood/paper/velvet palette.
- Menu model: data-driven stack-based DOM overlay menus with submenu/back/close behaviors and custom menu item renderers (e.g., `letter`).
- Save model (current scaffold): browser `localStorage` envelope including settings + local simulation, with JSON export/import roundtrip and persisted player pose (`position`, `yaw`, `pitch`).
- Controls model (current scaffold): dual bindings (keyboard + gamepad button/axis) with HID-safe rebind capture baseline.
- Module generation model: parameterized generator profiles for generic module types and exact module variants (`--interior-profile auto|none|captains-cabin`).
- Module runtime registry model: one handler file per module template under `src/modules/handlers/*.ts`, with `src/modules/registry.ts` as the single wiring point for fixed modules, insertable modules, and capability metadata (e.g., battery supply).
- Lighting model (current scaffold): UTC-driven global sun + ambient from observer lat/lon and planet parameters.
- Generated version artifacts:
  - `public/version.js` (local/dev fallback and build-time overwrite),
  - `dist/version.js` (must match deployed build version).

## Required Workflow

### 1) Local Development
- `./dev-prepare.sh` for baseline setup/checks.
- `./dev-run.sh` to run dev server.
- `./dev-test.sh` for lint/typecheck/test.
- `./dev-build.sh` for production build.
- `./dev-build-bump-ver.sh` to bump patch version then build.

### 2) Release Build
- Prefer `./prod-release.sh` (delegates to npm release flow).
- Build must produce:
  - `dist/version.js` with current package version,
  - `dist/sw.js` with versioned cache name,
  - deployable `dist/` artifact.

### 3) CI/CD (Pages)
- Use `.github/workflows/build-and-deploy.yml`.
- Keep build artifact path as `dist`.
- Post-deploy verification remains required on live Pages URL.

## Runtime Architecture Rules

- Keep simulation deterministic and decoupled from render FPS.
- Preserve planned timing domain separation:
  - `simTick`, `renderTick`, `terrainHarvestTick`, `audioTick`.
- Keep state transitions event/command driven.
- Keep UI as state consumer/dispatcher, not direct simulator mutator.
- Keep spherical math correctness constraints explicit in all nav work.
- Early-development fail-fast policy is strict: do not add save/data migrations, do not add fallback execution paths, and do not hide exceptions.

## Floor/Module Ownership Rules

- Use explicit per-floor ownership for interior modules via level-keyed arrays (`floorModuleIdsByLevel`).
- Never resolve missing floor module arrays by inheriting from another floor; missing level state is a defect and should throw.
- Keep ladder shaft alignment stable across levels by preserving a shared ladder center Z when floor layouts are rebuilt.
- Compute movement/collision bounds from actual rendered placement extents, not assumptions tied to only one active floor.

## Module Type Extension Rules

- Add new module templates by creating a dedicated handler file in `src/modules/handlers/` and exporting it via `src/modules/handlers/index.ts`.
- Keep module capability flags (e.g., battery supply) in handler metadata, not hardcoded ID-prefix checks in runtime logic.
- Route chain construction and insertable-choice generation through `src/modules/registry.ts` only.
- Keep fixed module rules (`cockpit` front, `cargo` rear) enforced by registry-level logic.

## Rendering and UI Guardrails

- Preserve 320x320 logical rendering concept.
- Keep menu/dialog UI as accessible DOM overlays.
- Use pixel-style scale tokens; avoid random per-component hardcoded styling.

### Known Early Pitfall: Growing Canvas/Square in Dev

If visual surface appears to grow continuously:
- Check for `ResizeObserver` feedback loops where observed size is immediately rewritten.
- Avoid style updates that change the observed container dimensions each callback.
- Prefer stable wrapper sizing and only update renderer/canvas dimensions from external layout changes.
- Add temporary logging around resize callback dimensions to verify convergence.

### Known Early Pitfall: Texture Update Warning on First Frames

If you see `THREE.WebGLRenderer: Texture marked for update but no image data found`:
- Ensure tile textures are preloaded before creating module meshes/materials.
- Avoid cloning repeat-variant textures before the source image is loaded.
- Centralize texture configuration (wrap, color space, anisotropy) for both preload and fallback load paths.

## Pre-Commit / Pre-Handoff Checklist

- Run `./dev-test.sh` and `./dev-build.sh`.
- Confirm `dist/version.js` matches `package.json` version.
- Confirm `dist/sw.js` regenerated in build.
- Update `ROADMAP.md` status and any parity notes touched by the change.
- Keep `.github/copilot-instructions.md` current if project reality changed.

## Post-Deploy Checklist (GitHub Pages)

- Validate first-load app shell and no critical console errors.
- Validate manifest installability.
- Validate offline refresh after first online visit.
- Validate update path by version bump + redeploy (service worker update lifecycle).
- Validate repo-subpath asset/deep-link behavior on Pages.
