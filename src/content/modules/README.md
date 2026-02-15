# Generated Module Definitions

This folder stores module metadata artifacts (`*.module.json`) for Airship One interior modules.

## Generator

Create a new starter shell from parameters:

`npm run generate:module -- --id <module_id> --module-type <room|open|cockpit|cargo> [--interior-profile <auto|none|captains-cabin|battery-room|ladder-room-none|ladder-room-floor-hole|ladder-room-ceiling-hole|ladder-room-through>]`

Examples:

- `npm run generate:module -- --id captains_cabin_mk1 --module-type room`
- `npm run generate:module -- --id captains_cabin_mk1 --module-type room --interior-profile captains-cabin`
- `npm run generate:module -- --id ladder_room_middle_mk1 --module-type room --interior-profile ladder-room-through`
- `npm run generate:module -- --id cockpit_mk1 --module-type cockpit`
- `npm run generate:module -- --id cargo_mk1 --module-type cargo`

The generator is the source of truth for both generic module types and exact module variants.

- `--interior-profile auto` maps known exact IDs to authored interior layouts.
- Current exact profiles:
	- `captains-cabin` (bed, locker, bookshelf with leather-bound books, desk, chair, A4 paper)
	- `battery-room` (battery boxes + electrical control panel)
	- `ladder-room-*` variants with climb volume and floor/ceiling hole options

Script location: `scripts/generate-module-shell.mjs`

## What gets generated

- Parametric block shell geometry (`geometry.blocks`)
- Walkable volumes (`volumes.walkable`)
- Blocked volumes (`volumes.blocked`)
- Doorway volumes (`volumes.doorway`)
- Climb volumes (`volumes.climb`)
- Head-bump volumes (`volumes.headBump`)
- Texture role assignments and bindings (`texturePalette`, `textureBindings`)

## Current starter module

- `captains_cabin_mk1.module.json`
- `battery_room_mk1.module.json`
- `ladder_room_single_mk1.module.json`
- `ladder_room_lowest_mk1.module.json`
- `ladder_room_middle_mk1.module.json`
- `ladder_room_highest_mk1.module.json`
