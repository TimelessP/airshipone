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
