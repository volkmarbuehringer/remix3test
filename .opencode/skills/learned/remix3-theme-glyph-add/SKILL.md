---
name: remix3-theme-glyph-add
description: "Use when a remix3 screen needs an icon that isn't in the theme glyph set, or when adding a Glyph name<...> trips a TS2339/TS2741 'GlyphValues' missing-property error — the glyph contract (glyphNames) and the rmx-01 preset (glyphValues) must be edited in sync, and each name's symbol id is auto-derived as rmx-glyph-<name>"
metadata:
  origin: auto-extracted
---

# Remix 3 Theme: Adding a New Glyph / Icon

**Extracted:** 2026-09-06
**Context:** Extending the theme icon set (e.g. to turn a text link into an icon button) by adding a new `Glyph name="..."`.

## Problem

The theme's icon set is a closed, typed contract. There is no free-form icon until you add one; `<Glyph name="download" />` fails typecheck (`name` not assignable to `GlyphName`) and renders nothing. The set spans two files that must stay in sync:

- `app/ui/theme/glyph-contract.ts` — the `glyphNames` array (drives the `GlyphName` union and the auto-derived symbol id).
- `app/ui/theme/presets/rmx-01/glyphs.tsx` — the `glyphValues` object (the actual `<symbol>` SVG per name).

`GlyphValues = Readonly<Record<GlyphName, GlyphSymbol>>`, so every entry in `glyphNames` MUST have a matching symbol in `glyphValues`. Edit only one side and tsc fails (missing `glyphValues` key, or excess object property). Each name's id is auto-derived as `rmx-glyph-<name>` (`DEFAULT_GLYPH_ID_PREFIX = 'rmx-glyph'`); `Glyph name="x"` renders `<use xlinkHref="#rmx-glyph-x">`. `app/ui/theme/presets/rmx-01/index.ts` wires it via `createGlyphSheet(glyphValues)`, and `rmx-01` is currently the only preset.

## Solution

Add the icon to BOTH files; you must change the contract and the preset together.

`app/ui/theme/glyph-contract.ts` — add the name in alphabetical position:

```ts
export const glyphNames = [
  ...
  'copy',
  'download',
  'edit',
  ...
]
```

`app/ui/theme/presets/rmx-01/glyphs.tsx` — add a matching `symbol(...)` to `glyphValues`. Symbols use the shared `viewBox="0 0 16 16"`, `fill="none"`, `stroke="currentColor"`, `strokeWidth="1.5"`, round linecaps/joins:

```ts
download: symbol(
  createElement('path', { d: 'M8 3v6.25', fill: 'none', stroke: 'currentColor', strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '1.5' }),
  createElement('path', { d: 'm4.5 6.5 3.5 3.25L11.5 6.5', fill: 'none', stroke: 'currentColor', strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '1.5' }),
  createElement('path', { d: 'M3 11.5h10', fill: 'none', stroke: 'currentColor', strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '1.5' }),
),
```

Then use it: `<Glyph name="download" width={14} height={14} />`.

## When to Use

- Task asks for an icon missing from the set (e.g. convert a text link to an icon button).
- Any `TS2339`/`TS2741`/excess-property type error on a `Glyph name=...` or `glyphValues`.
- Confirming which files define the icon set before adding one.

## Notes

- Only one preset exists today (`rmx-01`); if that changes, the new symbol must be added to every preset's `glyphValues`.
- Adding the name to the contract changes `GlyphName` globally, so the symbol must exist before typecheck passes.
