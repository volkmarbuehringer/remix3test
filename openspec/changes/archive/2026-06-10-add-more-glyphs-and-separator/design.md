## Context

The RMX_01 glyph preset (`remix/packages/ui/src/theme/presets/rmx-01/glyphs.tsx`) currently defines 17 named icons. The glyph contract (`glyph-contract.ts`) maps each name to an ID. The glyph sprite is already rendered in `app/ui/document.tsx` via `<RMX_01_GLYPHS />`.

The app has ~30 inline SVGs that don't match any existing glyph. The 6 `<div role="separator">` instances use manual ARIA markup without the library's theme-consistent `Separator` component.

## Goals / Non-Goals

**Goals:**
- Add glyph names to `glyph-contract.ts` and path definitions to `glyphs.tsx` for the most-repeated inline SVG icons
- Replace all matching inline SVGs app-wide with `<Glyph name="..." />`
- Replace the password toggle's `innerHTML` SVG swap with a `clientEntry` rendering `Glyph` components
- Replace all `<div role="separator">` with `<Separator />` from `remix/ui/separator`
- Maintain identical visual output — glyph paths should match current SVG shapes
- Keep glyph sprite 16×16 viewBox with `strokeWidth: 1.5` stroke style

**Non-Goals:**
- Replacing every single inline SVG — low-reuse icons (puzzle piece, document, play triangle, lightning bolt, shield, dollar, calendar) are kept if they appear only once
- Changing the glyph sprite rendering mechanism
- Adding any route, controller, or data changes
- Changing the password toggle's click delegation mechanism — only the icon rendering changes

## Decisions

### Decision 1: New glyph names — top 12 by reuse frequency

The icons with the most occurrences across the codebase get glyph names first:

| Rank | Concept | Occurrences | Glyph Name |
|------|---------|-------------|------------|
| 1 | Eye (show password) | 8 | `eye` |
| 2 | Eye-off (hide password) | 1 (paired with eye) | `eyeOff` |
| 3 | Clock / timer | 4 | `clock` |
| 4 | Send / paper-plane | 2 | `send` |
| 5 | Chat bubble | 2 | `chat` |
| 6 | User / person silhouette | 3 | `user` |
| 7 | Arrow right (shaft + chevron) | 3 | `arrowRight` |
| 8 | Settings / cog | 1 | `cog` |
| 9 | Moon / crescent | 1 | `moon` |
| 10 | Shield | 1 | `shield` |
| 11 | Lightning / zap | 1 | `zap` |
| 12 | Calendar | 1 | `calendar` |

One-occurrence icons (zap, shield, calendar) are included because their visual concepts are generally useful beyond current usage.

### Decision 2: Glyph path style — match RMX_01 16×16 stroke convention

All new glyph paths follow the existing pattern:
- `viewBox="0 0 16 16"`
- `fill="none"`, `stroke="currentColor"`, `strokeWidth="1.5"`
- `strokeLinecap="round"`, `strokeLinejoin="round"` (except where inappropriate)
- Base paths on the Feather/Lucide equivalents scaled from 24×24 to 16×16

### Decision 3: Separator — drop-in replacement

`<Separator />` from `remix/ui/separator` renders to `<div role="separator">` with theme-consistent border styling. The replacement is mechanical — same output, but uses theme tokens:

```
// Before:
<div role="separator" />

// After:
import { Separator } from 'remix/ui/separator'
<Separator />
```

### Decision 4: Password toggle — keep clientEntry, replace innerHTML

The password toggle currently injects SVG strings via `btn.innerHTML = eyeOffSvg`. The new approach keeps the same `clientEntry`/event delegation structure but renders `Glyph` components inside the button instead of innerHTML strings. The button element itself gains `data-toggle-pw` attribute and holds the current toggle state.

### Decision 5: Inline SVGs not replaced

Low-frequency inline SVGs (puzzle piece, document/file, play triangle, assistant avatar info circle, dollar, app logo/favicon) remain inline. They're either brand-specific, composite shapes, or single-use.

## Risks / Trade-offs

- **[Glyph sprite overhead]** Adding ~12 glyphs increases the sprite by ~2KB uncompressed. Mitigation: The sprite is static and cacheable.
- **[Password toggle refactor]** Changing from `innerHTML` to component rendering touches the toggle mechanism. Mitigation: The event delegation structure stays the same — only the icon rendering changes.
- **[Missed visual match]** If glyph paths don't perfectly match the Feather originals, there could be slight visual drift. Mitigation: Base glyph paths on the existing SVG shapes used in the app, not on new designs.
- **[Inconsistent icon sizes]** Existing inline SVGs use varying sizes (18×18 for password toggle, 24×24 in layouts, etc.). Glyph uses default 16×16. Mitigation: Pass explicit `width`/`height` props to `<Glyph>` matching the current displayed size.
