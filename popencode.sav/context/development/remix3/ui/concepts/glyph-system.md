# Concept: Glyph System

**Core Idea**: `createGlyphSheet()` renders a hidden SVG sprite sheet in the document body. The `<Glyph />` component references sprites by name for shared, consistent icon usage across the app.

**Key Points**:
- `createGlyphSheet()` returns a component; render it once near the top of `<body>`
- `<Glyph name="icon-name" />` references a sprite via `<use href="#icon-name">`
- Sprite sheet is visually hidden — only referenced via `<use>` elements
- Import `<Glyph />` from `@remix-run/ui/glyph`; sheet + theme from `@remix-run/ui/theme`
- Works with first-party components like `<Button startIcon={<Glyph name="add" />} />`

**Quick Example**:
```tsx
import { Button } from '@remix-run/ui/button'
import { Glyph } from '@remix-run/ui/glyph'
import { RMX_01, RMX_01_GLYPHS } from '@remix-run/ui/theme'

function Layout(props: { children: RemixNode }) {
  return (
    <html>
      <head><RMX_01 /></head>
      <body>
        <RMX_01_GLYPHS /> {/* Hidden SVG sprite sheet */}
        <Button startIcon={<Glyph name="add" />} tone="primary">
          New project
        </Button>
        {props.children}
      </body>
    </html>
  )
}
```

**Reference**: `packages/ui/README.md`
