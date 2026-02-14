---
name: airship-one-design
description: Airship One UI and visual design guardrails for square-viewport composition, rem-based sizing, and 24-row text rhythm.
---

# Airship One Design Skill

Use this skill whenever implementing or changing UI layout/styling.

## Design Baseline

- Entire playable composition is a single square (`game-square`) fit to available viewport.
- No UI should live outside that square.
- Page should naturally avoid scrollbars by layout design.

## Sizing System (Required)

- Use `rem` for sizing values in styles.
- Avoid `px` and `em` for UI sizing.
- Use runtime scale tokens set on `.game-square`:
  - `--u` for pixel-outline rhythm,
  - `--row` for 24-row vertical rhythm,
  - `--text-size` for readable baseline typography.
- Recompute these tokens on viewport resize so text stays readable as users resize browser windows.

## Typography Rules

- Target 24-row text rhythm for on-screen text layout.
- Keep text size consistent; prefer emphasis through:
  - weight (`font-weight`),
  - style (`italic`),
  - decoration (`underline`),
  - case transforms and spacing.
- Bias toward readability for older eyes: avoid tiny text defaults.
- Do not use emoji in UI copy, labels, or iconography.

## Theme Rules (Victorian)

- Support both `light` and `dark` theme modes.
- Keep palette grounded in desaturated, worn tones:
  - wood browns,
  - paper creams,
  - green velvet,
  - red velvet accents.
- Theme changes should be variable-driven (token swap), not per-component hardcoded rewrites.

## UI Placement Rules

- Overlay UI belongs in `.ui-layer` inside `.game-square` only.
- Avoid external page chrome around the game square.
- Keep focus outlines and borders tied to `--u`.

## Top Bar Rules (Required)

- Keep a persistent full-width top bar at the top of `.game-square`.
- Left control is an SVG hamburger button for opening/closing pause/main menu overlays.
- Center content is the title text: `Airship One`.
- Right control is an icon-only SVG theme switcher (system/light/dark), no text label in button body.
- Do not add placeholder/dummy informational panels on the menu screen.

## Validation Checklist

- `./dev-test.sh` passes.
- `./dev-build.sh` passes.
- Validate visual design on the live Pages URL: `https://timelessp.github.io/airshipone/`.
- At common viewport sizes, no page scrollbars appear.
- Text remains readable and visually consistent.
- Button and panel outlines scale with `--u`.
