<!-- Context: development/remix3/concepts/remix-ui | Priority: medium | Version: 1.0 | Updated: 2026-04-29 -->

# Concept: Remix UI Runtime

**Core Idea**: The `remix/ui` package provides runtime UI primitives — a component rendering/hydration system, server streaming, `mix` composition helpers, first-party components (buttons, menus, popovers), typed theme tokens via `createTheme()`, and glyph sheets via `createGlyphSheet()`. All component-related APIs are in `remix/ui` (the separate `remix/component` subpath does NOT exist).

**Key Points**:
- **Component runtime**: APIs for rendering, hydration, frame navigation, and JSX without React
- **Server rendering**: Stream UI trees and frames from the server
- **`mix` composition**: Compose event handlers, refs, CSS, and animations into a single mixin
- **Theme system**: `createTheme()` returns a typed contract; render `<Theme />` in `<head>` to emit `var(--rmx-...)` CSS custom properties
- **First-party components**: `Button`, `Menu`, `Listbox`, `Popover`, `Select` from `remix/ui/*`
- **Glyphs**: `createGlyphSheet()` renders a hidden SVG sprite sheet; `<Glyph name="add" />` references sprites

**Quick Example**:
```ts
import { css, createTheme, theme } from 'remix/ui'

let Theme = createTheme({ space: { sm: '4px', md: '8px' } })
let card = css({ padding: theme.space.md })
// <Theme /> in <head>, <div mix={card} /> to apply
```

**Reference**: `packages/ui/README.md`

**Related**:
- concepts/theme-contract.md — Deep dive on `createTheme()` tokens
- concepts/glyph-system.md — Glyph sheet + `<Glyph />` component
- guides/ui-setup.md — Installation and setup guide
- lookup/ui-api-reference.md — UI exports reference
