## Why

The app's theme surface levels (lvl0–lvl4) are inverted relative to the RMX_01 convention — the highest-elevation surfaces (`lvl0`) are darkest while deep panels (`lvl4`) are lightest, making cards and modals appear unexpectedly dark. Separately, the app uses 42 hardcoded inline SVGs and 5 emoji/text characters as icons instead of the library's `Glyph` component, creating inconsistency in icon sizing, theming, and accessibility.

## What Changes

1. **Fix surface level values** — Reorder `lvl0`–`lvl4` in `app/theme.tsx` so `lvl0` = lightest/elevated (cards, modals) and `lvl4` = deepest (subtle backgrounds), matching RMX_01 semantics. Both light and dark modes updated.

2. **Adopt `Glyph` component** — Replace strategic hardcoded SVGs and emoji icons with `<Glyph name="..." />` from `remix/ui/glyph`. Target the most visible, frequently used icons first:
   - Layout: logout icon, theme toggle emoji (🌓 → sun/moon glyphs)
   - AI sidebar nav icons
   - Admin sidebar nav icons
   - Lists client CRUD buttons (✓/✕)
   - AI/agent/workflow page action icons

## Capabilities

### New Capabilities

- `glyph-adoption`: Adopt the library's `Glyph` component across the app's UI, replacing hardcoded inline SVGs and emoji icons.
- `semantic-surface-tokens`: Define surface level token semantics (lvl0 = elevated, lvl4 = deepest) and apply them consistently throughout the codebase.

### Modified Capabilities

_N/A — no existing specs to modify._

## Impact

- **Files changed**: `app/theme.tsx` (surface values), plus ~12–15 UI files replacing SVGs with Glyph
- **No API changes**: Pure UI refactor, no route/controller/data changes
- **No dependency changes**: `Glyph` is already available via `remix/ui/glyph`
- **Visual change**: Some components will look slightly different as surface levels invert — cards get lighter, deep panels get darker
- **Bundle**: SVGs move from inline markup to SVG sprite (negligible diff, probably smaller)
