# Airship One 3D Asset Pipeline (Modular Interior)

This document defines how Airship One interior 3D assets are authored, textured, and validated.

## Goals

- Keep all interior modules data-driven and hot-swappable.
- Keep player movement semantics explicit with authored walk/collision/interaction volumes.
- Keep texel density consistent across all interior assets.
- Keep texture sourcing artist-friendly (small square PNG inputs) while runtime uses packed 1024x1024 atlases.

## Module Architecture

## Fixed and Dynamic Modules

- Fixed front module: `cockpit`.
- Fixed rear module: `cargo`.
- All middle modules are dynamic inserts/removals in a linear chain.

## Slot Graph

- Interior topology is represented as ordered module slots.
- Each module has `frontSlot` and `rearSlot` connection points.
- Insert action (`+`) on an inter-module wall inserts a compatible module between neighbors.
- Remove action (`-`) removes the targeted module if removal constraints pass.

## Removal Constraints

- `cockpit` and `cargo` are non-removable.
- A removable module must not be the only connector between required fixed modules.
- Player must not be left inside a deleted module volume.

## Asset Package Standard

Each module is a package with geometry + metadata:

- `moduleId.glb` (render mesh; optional helper nodes for anchors)
- `moduleId.module.json` (authoritative gameplay metadata)

## Module Metadata Schema (v1)

```json
{
  "schema": "airshipone.module.v1",
  "id": "engine_room_mk1",
  "category": "interior-module",
  "size": { "lengthU": 1, "widthM": 4.8, "heightM": 2.6 },
  "connectors": {
    "front": { "type": "corridor", "widthM": 1.2, "heightM": 2.1 },
    "rear": { "type": "corridor", "widthM": 1.2, "heightM": 2.1 }
  },
  "anchors": {
    "insertButtonFront": { "position": [0.0, 1.35, -1.45] },
    "removeButton": { "position": [0.85, 1.35, 0.0] }
  },
  "volumes": {
    "walkable": [],
    "blocked": [],
    "climb": [],
    "headBump": [],
    "doorway": []
  },
  "textureBindings": [],
  "tags": ["crew-access", "maintainable"]
}
```

## Module Sizing Standard (v1)

This standard defines minimum module dimensions from corridor + room constraints.

### Layout Assumptions

- Corridors run on both sides of every module along gondola length.
- Corridor windows are in each corridor's outer wall.
- Non-room modules (`cockpit`, `cargo`) have no inner room partition walls.
- Room modules (`captain_cabin`, `radio_room`, etc.) have central room enclosed by two inner walls, with door access from corridor side(s).

### Fixed Defaults

- Outer wall thickness `tOuter = 0.10m`
- Inner wall thickness `tInner = 0.10m`
- Corridor clear width `wCorridor = 1.00m`
- Corridor door clear width `wDoor = 0.90m`
- Internal clear height target `hClear = 2.30m` (`heightM` remains `2.60m` envelope)

### Bed Fit Requirement (Room Modules)

Use a normal single bed frame bounding footprint:

- Bed length `lBed = 2.00m`
- Bed width `wBed = 1.00m`

Require room to support either orientation:

- **Lengthways bed case**: room length must include bed + doorway approach zone.
- **Sideways bed case**: room width must include bed length + side clearances.

Defaults used for baseline sizing:

- Doorway/foot circulation allowance `aDoor = 0.90m`
- Side clearance allowance `aSide = 0.40m` total (combined both sides)

Therefore minimum room clear dimensions are:

- `roomLengthMin = lBed + aDoor = 2.90m` → rounded to `3.00m`
- `roomWidthMin = lBed + aSide = 2.40m`

### Derived Module Envelope (Room Module, 1U)

Given `roomWidth = 2.40m` and `roomLength = 3.00m`:

- `moduleWidth = (2 * tOuter) + (2 * wCorridor) + (2 * tInner) + roomWidth`
- `moduleWidth = 0.20 + 2.00 + 0.20 + 2.40 = 4.80m`

- `moduleLength(1U) = roomLength + (2 * tOuter)`
- `moduleLength(1U) = 3.00 + 0.20 = 3.20m`

Standard baseline envelope:

- `widthM = 4.80`
- `lengthU = 1` where `1U = 3.20m`
- `heightM = 2.60`

### Cockpit and Cargo Sizing Rule

- `cockpit` and `cargo` keep the same external width (`4.80m`) and corridor alignment interfaces.
- They may omit inner walls and central enclosed-room constraints.
- They can be multi-length (`lengthU >= 1`) while preserving connector compatibility.

### Grid and Quantization

- Author all dimensions/snaps on a `0.10m` grid.
- Use `lengthU` increments of `0.5U` minimum for larger modules.


## Volume Semantics

Volumes are separate from visible mesh and are authored in module-local coordinates.

- `walkable`: spaces where player capsule center is allowed.
- `blocked`: explicit no-go solids (walls, machinery, overlap blockers).
- `climb`: ladder/stair traversal zones with constrained locomotion mode.
- `headBump`: upper boundary blockers for jump/head collision.
- `doorway`: transition gates used for room adjacency and contextual prompts.

Rule: playable space = `walkable` minus (`blocked` union disallowed overlaps).

Runtime occupancy rule:

- Candidate player point must be inside (`walkable` OR `doorway`).
- Candidate point must not be inside `blocked` (except explicit doorway carve-through handling).

## Primitive Volume Shapes

- `box`: `{ center:[x,y,z], halfExtents:[x,y,z] }`
- `capsule`: `{ a:[x,y,z], b:[x,y,z], radius:r }`
- `convex`: `{ points:[[x,y,z], ...] }`

Prefer boxes/capsules first for deterministic, fast broad-phase checks.

## Texture Pipeline (Texel-Consistent)

## Source Textures

- Artist-provided source textures are square PNG files.
- Recommended source sizes: `256`, `512`, `1024` (power-of-two).
- Inputs are semantic tiles (metal panel, rivets, wood trim, hatch paint), not per-object atlases.

### Repository Locations

- `assets/textures/tiles/` for seamless repeat materials.
- `assets/textures/trim/` for borders/strips/rivet bands.
- `assets/textures/decals/` for symbols/labels/signage.
- `assets/textures/wip/` for unapproved draft textures.

## Build-Time Atlas Consolidation

Build packs source PNG tiles into one or more `1024x1024` atlas pages.

- Atlas generation outputs:
  - `atlas-page-XX.png`
  - `atlas-manifest.json` (UV rects, padding, mip-safe insets, source fingerprint)
- Runtime meshes never hardcode final UV pixels.
- Runtime resolves UV placement via manifest rects.

## Texel Density Contract

- Global interior target density: `D` texels per meter (configured in build settings).
- Each mesh surface binding declares desired world scale in meters.
- Build computes effective UV scaling from surface meters and target `D`.
- If a source texture is too low-res, build fails with actionable diagnostics.

## Texture Binding Record

```json
{
  "mesh": "WallPanel_A",
  "materialSlot": "albedo",
  "tileId": "victorian_brass_panel_01",
  "uvMode": "repeat",
  "worldScaleM": [1.0, 1.0],
  "rotationDeg": 0,
  "mirrorX": false,
  "atlasPage": 0,
  "atlasRectPx": [128, 256, 256, 256]
}
```

## Module Interaction Anchors

Each module can expose interaction anchors:

- `insertButtonFront` / `insertButtonRear`: where `+` affordance appears near corridor doorway walls.
- `removeButton`: where `-` affordance appears.
- optional station anchors (`console`, `ladderBase`, `maintenancePanel`).

Anchors are data; UI uses them to place prompts/buttons in 3D-to-UI projected overlays.

## Ceiling Light Standard (Required)

- Each module includes one low-height, wide-diameter cylindrical ceiling light centered in module local space.
- Light fixture sits just below ceiling level.
- Fixture material is bright/emissive to read as a lit lamp body.
- Runtime adds one pale yellow, dim-ish local light source per fixture.
- Ceiling light local sources must not cast shadows.

## Validation Gates

The pipeline should fail build when:

- Module connector dimensions are incompatible with neighboring slot rules.
- Any `walkable` region is isolated from both connector doorways.
- `blocked` overlaps fully erase required corridor path.
- Texture binding references missing `tileId` or atlas manifest entries.
- Effective texel density deviates from target beyond configured tolerance.

## Collaborative Authoring Workflow (You + Copilot)

For each new module, we follow this fixed loop:

1. You describe module intent:
   - role (captain cabin/comms/engine/etc), dimensions, corridor placement, key props.
2. Copilot drafts:
   - module blueprint (`moduleId.module.json` draft),
   - volume plan (`walkable`/`blocked`/`climb`/`headBump`/`doorway`),
   - texture tile request list (square PNG prompts/specs).
3. You generate/revise texture PNG tiles.
4. Copilot wires texture bindings and validates texel density and connectivity rules.
5. We run build checks and iterate until module passes all gates.

## Texture Request Template

When requesting a new tile set, Copilot should provide:

- `tileId`
- visual intent and material cues
- required seamlessness (x/y)
- preferred source size (`512`/`1024`)
- roughness/normal needs (if enabled)
- usage surfaces and expected world scale

## Runtime Integration Notes

- Simulation owns authoritative module graph and collision query data.
- Rendering consumes module graph snapshots for visual mesh instancing.
- UI dispatches `insert-module` / `remove-module` commands; simulator validates constraints.
- Module add/remove must be deterministic and save-serializable.

## Parameter-Driven Module Shell Generator (Current)

Use the generator script to produce consistent starter shells from sizing parameters:

- Command: `npm run generate:module -- --id <module_id> --module-type <room|open|cockpit|cargo> [--interior-profile <auto|none|captains-cabin|battery-room|ladder-room-none|ladder-room-floor-hole|ladder-room-ceiling-hole|ladder-room-through>]`
- Script: `scripts/generate-module-shell.mjs`
- Output: `src/content/modules/<module_id>.module.json`

### Supported Parameters

- `--id` module identifier
- `--module-type`
  - `room`: inner walls + side room doorways
  - `open`: no inner walls
  - `cockpit`: fixed-module open shell profile (no inner walls)
  - `cargo`: fixed-module open shell profile (no inner walls)
- `--interior-profile`
  - `auto`: infer known exact profile from module id
  - `none`: no extra interior furniture blocks
  - `captains-cabin`: apply captain cabin furnishing layout
  - `battery-room`: apply battery room furnishing layout
  - `ladder-room-none`: ladder room without floor/ceiling cut-through holes
  - `ladder-room-floor-hole`: ladder room with floor opening only
  - `ladder-room-ceiling-hole`: ladder room with ceiling opening only
  - `ladder-room-through`: ladder room with both floor and ceiling openings
- `--length-u` module length in U units (`1U = 3.2m`)
- `--room-width-m`, `--room-length-m`
- `--corridor-width-m`, `--corridor-door-width-m`
- `--wall-outer-m`, `--wall-inner-m`, `--height-m`, `--clear-height-m`
- `--output` explicit output path (optional)

### How It Builds the Module (Slow, Layered Construction)

1. **Block shell generation**
  - Creates floor and ceiling slabs.
  - Creates front/rear bulkheads.
  - Creates segmented outer walls with explicit window cutouts (lower strip + upper strip + end pillars).
  - Creates dedicated window pane strips in the cutout opening.
  - Creates one centered cylindrical ceiling-light fixture below ceiling level.
  - For `room` modules, creates two inner partition walls with doorway openings and lintels.
2. **Walkable volumes**
  - Creates left corridor walkable prism.
  - Creates right corridor walkable prism.
  - Creates central room walkable prism.
3. **Blocked volumes**
  - Creates explicit blocked prisms for all outer-wall solid segments and bulkheads.
  - Creates explicit blocked window-strip prisms for consistent corridor glazing collision behavior.
  - For `room` modules, creates blocked segments for inner wall solids around door gaps.
4. **Doorway and head-bump volumes**
  - Creates front/rear doorway volumes for both corridor lanes.
  - Creates side doorway volumes into room where applicable.
  - Creates a ceiling `headBump` band so jump head collisions are deterministic.
5. **Texture application**
  - Scans `assets/textures/tiles/*.png`.
  - Auto-assigns role-based tiles (`floor`, `wall`, `innerWall`, `ceiling`, `window`, `trim`) by filename match.
  - Emits explicit `textureBindings` per generated block.

### Starter Artifact

- First generated example: `src/content/modules/captains_cabin_mk1.module.json`
- Fixed-module examples:
  - `src/content/modules/cockpit_mk1.module.json`
  - `src/content/modules/cargo_mk1.module.json`

### Generator-First Exact Module Rule (Required)

- Exact module variants must be authored as generator profiles, not hand-edited JSON.
- Generic module types (`room`, `open`, `cockpit`, `cargo`) remain parameterized bases.
- Exact module IDs (for example `captains_cabin_mk1`) select a profile via `--interior-profile` or `auto` inference.
- Regenerating a module JSON must be deterministic from script + parameters.

### Captains Cabin Profile (Current)

`captains-cabin` profile adds room furnishings as generated blocks with matching collision blockers:

- bed
- locker
- bookshelf unit
- leather-bound books in shelf rows
- desk
- chair
- A4 sheet of paper on desk

### Window Construction Rule (Required)

- Corridor windows are represented as **wall cutouts**, not overlapping transparent decals on solid walls.
- Outer wall geometry must be split so the opening is physically empty before pane placement.
- Window pane block depth must be **narrower than wall thickness** and inset from wall surfaces to avoid z-fighting.
- Window pane texture alpha channel must be honored at runtime (transparent material + alpha map/test), not rendered as opaque.

### Corridor Through-Way Rule (Required)

- Front/rear bulkheads must preserve corridor continuity between modules.
- Bulkhead geometry should occupy only the central room span; corridor lanes at both sides remain open passage.
- Matching blocked volumes must follow the same narrowed bulkhead geometry so movement/collision aligns with visuals.

### Join Control Rule (Required)

- At each inter-module join point, place one `+` control at the join center.
- Place `-` controls on either side of that join for removing adjacent modules.
- `cockpit` and `cargo` must not expose `-` removal controls.
- Activating `+` opens module-selection UI, including `empty_room` option.
- Join controls are proximity-gated at runtime (hidden when player is not near).
- A center reticle hint appears when near clickable join controls, even before direct target alignment.

### Player Placement Safety Rule (Required)

- After module insertion/removal (or any topology rebuild), validate current player occupancy.
- If player position is no longer occupiable, relocate to nearest occupiable point derived from authored `walkable`/`doorway` volumes.

Exception for fixed end modules:

- `cockpit` front end is sealed (no corridor through-way).
- `cargo` rear end is sealed (no corridor through-way).
- Cockpit front sealed end includes a front-facing window opening with inset pane.

### Inner Wall Collision Rule (Required)

- All inner wall solids (front/rear segments and lintels) must emit matching `blocked` volumes.
- Room doorway openings remain the only pass-through in inner partitions.
