## Why

The app uses ~30 inline SVGs (Feather/Lucide-style) for icons that have no matching glyph in the RMX_01 set. These bypass the `Glyph` sprite pattern, meaning each instance is a full SVG string that's not theme-consistent, not centrally cacheable, and harder to maintain. Separately, 6 `<div role="separator">` instances in context menus use manual markup instead of the library's `Separator` component, missing theme-consistent border styling.

## What Changes

1. **Add new glyphs to RMX_01 preset** — Add glyph definitions for the most-repeated inline SVG icons:
   - `eye` / `eyeOff` — password visibility toggle (8 occurrences)
   - `clock` — timestamps in workflow/ai pages (4 occurrences)
   - `chat` — chat bubble (2 occurrences)
   - `send` — send/paper-plane arrow (2 occurrences)
   - `user` — user/person silhouette (3 occurrences)
   - `moon` — dark mode toggle (1 occurrence)
   - `cog` — settings gear (1 occurrence)
   - `arrowRight` — arrow with shaft line (3 occurrences)
   - `shield` — security (1 occurrence)
   - `calendar` — date icon (1 occurrence)
   - `zap` — lightning bolt (1 occurrence)

2. **Replace inline SVGs with `<Glyph>`** — Across layouts, nav, chat pages, workflow pages, scaffold home, and admin sections.

3. **Replace password toggle innerHTML** — Replace the string-based SVG swap in `password-toggle.tsx` with a proper `clientEntry` that renders `Glyph` components.

4. **Adopt `Separator` component** — Replace all `<div role="separator">` with `<Separator />` from `remix/ui/separator` in context menus.

## Capabilities

### New Capabilities

- `glyph-expansion`: Extends the RMX_01 glyph set with ~11 new named icons and replaces all matching inline SVGs app-wide.
- `separator-adoption`: Adopt the library `Separator` component across all context menus.

### Modified Capabilities

- `glyph-adoption` (from `fix-theme-surfaces-add-glyphs`): Extends the existing glyph adoption work from 17 glyphs to ~28.

## Impact

- **Files changed**: `remix/packages/ui/src/theme/presets/rmx-01/glyphs.tsx` (new glyph defs), `remix/packages/ui/src/theme/glyph-contract.ts` (new glyph names), plus ~15 app files replacing SVGs
- **Bundle**: Inline SVGs move to the glyph sprite — negligible net change, sprite is cacheable
- **Visual**: Icons remain visually identical (same path shapes, just rendered via sprite)
- **No route/controller/data changes**
- **No dependency changes**
