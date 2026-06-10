## Why

The `ryan/component-rearchitecture` commit (`7f47d3d30`) in the upstream `remix` repo removes the `remix/ui/theme`, `remix/ui/glyph`, `remix/ui/button`, `remix/ui/separator`, and `remix/ui/breadcrumbs` subpath imports from the remix package manifest. The headless UI primitives were split from styled components, and the theme system was no longer re-exported.

This app depends on these subpath imports extensively:
- `remix/ui/theme` — ~60+ imports (theme contract, `createTheme`, glyph sheet, theme tokens)
- `remix/ui/glyph` — ~20 imports (`Glyph` component, `createGlyphSheet`)
- `remix/ui/separator` — ~5 imports (`Separator` component style)

When the upstream `preview/main` branch merges this change, every import from these paths will break. We must localize these modules before the merge lands.

## What Changes

1. **Local theme system** — Copy the theme contract, runtime, and RMX_01 preset from `packages/ui/src/theme/` into `app/lib/theme/`, adapting imports from `@remix-run/ui` to `remix/ui`.

2. **Local glyph system** — Copy the glyph contract and glyph component from `packages/ui/src/components/glyph/` into `app/lib/glyph/`, keeping the sprite-based rendering pattern.

3. **Local separator style** — Copy the separator CSS mixin from `packages/ui/src/components/separator/` into `app/lib/separator/`.

4. **Update all app imports** — Change every `from 'remix/ui/theme'`, `from 'remix/ui/glyph'`, `from 'remix/ui/separator'` to point to the new local modules.

5. **No behavioral change** — All local modules are faithful copies of the upstream source. Visual output, theme variable names, glyph IDs, and CSS output remain identical.

## Impact

- **~70 files changed** across the entire app (60 theme imports, 20 glyph imports, 5 separator imports)
- **3 new local modules** in `app/lib/`: `theme/`, `glyph/`, `separator/`
- **Zero behavioral change** — copies are faithful, only import paths change
- **Upstream-safe** — when the merge happens, no imports from removed paths remain
