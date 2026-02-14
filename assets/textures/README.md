# Texture Source Folders

Put source square PNG textures for atlas packing in this tree.

## Folders

- `assets/textures/tiles/` — seamless tiling materials (metal, wood, paint, fabric).
- `assets/textures/trim/` — edge strips, borders, rivet bands, panel trims.
- `assets/textures/decals/` — labels, symbols, signage, control markings.
- `assets/textures/wip/` — work-in-progress or review candidates not yet promoted.

## Naming

Use lowercase kebab-case names that map to `tileId`, for example:

- `victorian-brass-panel-01.png`
- `oak-trim-dark-01.png`
- `engine-warning-stripe-01.png`

## Source Size

Square PNG, preferably power-of-two:

- 256x256
- 512x512
- 1024x1024

The build pipeline will scale/crop and pack into 1024x1024 atlas pages.
