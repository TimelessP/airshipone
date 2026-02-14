# Generated Module Definitions

This folder stores module metadata artifacts (`*.module.json`) for Airship One interior modules.

## Generator

Create a new starter shell from parameters:

`npm run generate:module -- --id <module_id> --module-type <room|open|cockpit|cargo> [--interior-profile <auto|none|captains-cabin>]`

Examples:

- `npm run generate:module -- --id captains_cabin_mk1 --module-type room`
- `npm run generate:module -- --id captains_cabin_mk1 --module-type room --interior-profile captains-cabin`
- `npm run generate:module -- --id cockpit_mk1 --module-type cockpit`
- `npm run generate:module -- --id cargo_mk1 --module-type cargo`

The generator is the source of truth for both generic module types and exact module variants.

- `--interior-profile auto` maps known exact IDs to authored interior layouts.
- Current exact profile: `captains-cabin` (bed, locker, bookshelf with leather-bound books, desk, chair, A4 paper).

Script location: `scripts/generate-module-shell.mjs`

## What gets generated

- Parametric block shell geometry (`geometry.blocks`)
- Walkable volumes (`volumes.walkable`)
- Blocked volumes (`volumes.blocked`)
- Doorway volumes (`volumes.doorway`)
- Head-bump volumes (`volumes.headBump`)
- Texture role assignments and bindings (`texturePalette`, `textureBindings`)

## Current starter module

- `captains_cabin_mk1.module.json`
