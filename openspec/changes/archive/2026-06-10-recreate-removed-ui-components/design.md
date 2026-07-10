## Context

The upstream remix repo at `packages/ui/src/` still contains the full source for theme, glyph, and separator. These files import from `@remix-run/ui` (available as `remix/ui` in this app) and from sibling files within the module. The source can be copied nearly verbatim.

### Dependency chain

```
app/lib/theme/
├── layers.ts          ← inline of packages/ui/src/style/layers.ts (2 const strings)
├── contract.ts        ← imports from 'remix/ui' (types: Handle, RemixElement, css, MixinDescriptor)
├── runtime.ts         ← imports from ./contract.ts and ./layers.ts
├── glyph-contract.ts  ← imports from 'remix/ui' (type: RemixElement)
├── presets/
│   └── rmx-01/
│       ├── index.ts   ← imports from ../../../theme/runtime.ts, ../../../components/glyph/glyph.tsx
│       └── glyphs.tsx ← imports from 'remix/ui' (createElement, RemixNode)

app/lib/glyph/
├── glyph.tsx          ← imports from 'remix/ui' + ../theme/glyph-contract.ts

app/lib/separator/
└── separator.ts       ← imports from 'remix/ui' + ../theme/contract.ts
```

## Goals / Non-Goals

**Goals:**

- Create local `app/lib/theme/` with the full theme contract, runtime, and RMX_01 preset
- Create local `app/lib/glyph/` with the `Glyph` component and `createGlyphSheet`
- Create local `app/lib/separator/` with the `separatorStyle` CSS mixin
- Re-export everything through an `app/lib/theme.ts`, `app/lib/glyph.ts`, `app/lib/separator.ts` barrel for clean import paths
- Update all app imports to use the new local paths
- Keep all visual output identical

**Non-Goals:**

- Modifying the behavior or output of any copied module
- Recreating button or breadcrumbs (the app uses `remix/components/button` and `remix/components/breadcrumbs` as replacements)
- Adding new glyph names or changing glyph SVGs
- Refactoring the theme system API

## Decisions

### Decision 1: Module structure — flat barrels at `app/lib/`

Position the modules so import paths are short and consistent:

| Upstream path                                                                    | Local path                      |
| -------------------------------------------------------------------------------- | ------------------------------- |
| `remix/ui/theme` → `createTheme, theme, RMX_01, RMX_01_GLYPHS, glyphNames, etc.` | `app/lib/theme.ts` (barrel)     |
| `remix/ui/glyph` → `Glyph, type GlyphName`                                       | `app/lib/glyph.ts` (barrel)     |
| `remix/ui/separator` → `separatorStyle`                                          | `app/lib/separator.ts` (barrel) |

Each barrel re-exports from its `app/lib/<name>/` subdirectory. This mirrors the original pattern and keeps internal file structure accessible if needed.

### Decision 2: Preserve `RMX_01_GLYPHS` as a `<theme>`-style component

The glyph sprite is rendered in `document.tsx` via `<RMX_01_GLYPHS />`. The `createGlyphSheet` function returns a component with the same call signature as `createTheme`. The local copy preserves this API exactly.

### Decision 3: `separatorStyle` lives in `app/lib/separator/`

The separator module is just a CSS mixin, not a component. But the app uses it as `import { Separator } from 'remix/ui/separator'` in context menu files — they import `Separator` (which is the style applied via the `Separator` component re-export). Looking at usage, `separatorStyle` is the actual value. Keep it as a default export so the import pattern `import { Separator } from 'app/lib/separator'` continues to work.

### Decision 4: `@remix-run/ui` imports → `remix/ui`

All copied source files reference `@remix-run/ui` for `createElement`, `css`, `Handle`, `RemixElement`, `Props`, `MixinDescriptor`, `RemixNode`, and `CSSMixinDescriptor`. These are all available from `remix/ui` in this app. The import path `@remix-run/ui` is replaced with `remix/ui` during the copy.

### Decision 5: Layers constants inlined

The `REMIX_UI_STYLE_LAYER` and `REMIX_UI_RESET_LAYER` constants are trivial strings (`'rmx'` and `'rmx-reset'`). They move into `app/lib/theme/layers.ts` to avoid depending on the upstream `@remix-run/ui/style/layers` path.

### Decision 6: No file moves in `app/theme.tsx`

The existing `app/theme.tsx` defines light/dark theme values and exports `Theme`, `DarkTheme`, and `brand`. It currently imports `createTheme` from `remix/ui/theme`. After this change, it imports from `app/lib/theme` instead. The file stays in place — only one line changes.

## Risks / Trade-offs

- **[Divergence]** If the upstream source is later updated, the local copies won't pick up fixes. Mitigation: This is intentional — we're forking because the upstream is removing these modules. Future fixes would need to be applied manually.
- **[Bundle size]** Copying the full theme runtime adds ~2KB. Negligible.
- **[Glyph IDs]** The glyph contract generates IDs with prefix `rmx-glyph-*`. These are stable and match the current output.
- **[Dark mode theme reset]** The `createTheme` runtime includes a CSS reset that's emitted for `:root` only. Dark theme uses `reset: false`. This is preserved exactly.
