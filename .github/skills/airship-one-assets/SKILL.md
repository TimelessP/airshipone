---
name: airship-one-assets
description: Airship One modular 3D asset authoring standard for interior modules, walk/collision volumes, and build-time texel-consistent texture atlases.
---

# Airship One Assets Skill

Use this skill when defining, creating, or reviewing 3D interior assets and textures.

## Purpose

Keep module creation consistent, deterministic, and data-driven:
- modular interior assembly (insert/remove modules),
- explicit invisible gameplay volumes,
- texel-consistent texturing through build-time atlas packing.

## Source of Truth

- Asset pipeline specification: `.github/skills/airship-one-asset-pipeline/SKILL.md`.
- Product architecture and constraints: `ROADMAP.md`.
- Runtime and implementation guardrails: `.github/copilot-instructions.md`.

## Core Rules

- Treat `cockpit` (front) and `cargo` (rear) as fixed modules.
- Treat all interior modules between them as dynamic slot inserts/removals.
- Keep geometry and gameplay volumes separate.
- Never hardcode final atlas UV pixel positions in source meshes.
- Keep all texture source inputs as square PNG files.
- Enforce global texel density target through build-time scaling.

## Required Module Deliverables

For each module, produce:

1. `moduleId.glb` (render mesh and anchor helpers).
2. `moduleId.module.json` metadata including:
   - connectors (`front`, `rear`),
   - anchors (`insert/remove` controls, station anchors),
   - volumes (`walkable`, `blocked`, `climb`, `headBump`, `doorway`),
   - texture bindings (`tileId`, world scale, UV mode).
3. Validation notes:
   - corridor connectivity,
   - blocked-volume overlaps,
   - texel density compliance,
   - interaction anchor placement sanity.

## Volume Semantics (Required)

- `walkable`: where movement is allowed.
- `blocked`: no-go solids and collision blockers.
- `climb`: ladder/stair traversal zones.
- `headBump`: upper limits for jump/head collision.
- `doorway`: transition and adjacency gates.

Playable region must be computed from explicit volume sets, not inferred from visual mesh alone.

## Texture Workflow

- Accept artist tiles as square PNGs (`256/512/1024`).
- Build consolidates into `1024x1024` atlas pages.
- Runtime resolves atlas offsets from generated manifest.
- Fail build if density target cannot be met from source inputs.

## Collaboration Workflow (User + Copilot)

When user asks to create a module:

1. Ask only for missing essentials:
   - module role,
   - dimensions and corridor orientation,
   - key props and interactions,
   - desired visual material palette.
2. Draft module metadata and volume blueprint.
3. Produce texture tile request list for user image generation.
4. Wire texture bindings and atlas expectations.
5. Report validation checklist and remaining blockers.

## Texture Request Format

For every requested tile, include:

- `tileId`
- visual description/material cues
- seamlessness requirements
- source size target
- intended surfaces and world scale
- optional normal/roughness channel requirements

## Acceptance Checklist

Before handoff, confirm:

- module can connect front/rear without geometry mismatch,
- required corridor path is traversable,
- no invalid overlap between blocked/walkable zones,
- insert/remove anchors exist and are reachable,
- texture bindings resolve to atlas manifest entries,
- texel density target holds within tolerance.
