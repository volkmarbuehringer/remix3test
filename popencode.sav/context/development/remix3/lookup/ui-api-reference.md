<!-- Context: development/remix3/lookup/ui-api-reference | Priority: medium | Version: 1.1 | Updated: 2026-05-05 -->

# Lookup: Remix UI API Reference

## Package Entry Points

| Import | Source |
|--------|--------|
| `createTheme`, `css`, `theme`, `RemixNode` | `remix/ui` |
| `Button` | `remix/ui/button` |
| `Glyph` | `remix/ui/glyph` |
| `RMX_01`, `RMX_01_GLYPHS` (pre-built theme + glyphs) | `remix/ui/theme` |

> **Note**: `remix/component` subpath does **NOT** exist. The `component()` factory function does **NOT** exist. Components are plain factory functions receiving `handle` as the first parameter; `clientEntry` is used to mark browser-interactive components.

## Full `remix/ui` Exports (Verified at Runtime)

| Export | Type | Description |
|--------|------|-------------|
| `Fragment` | component | JSX fragment |
| `Frame` | component | Frame for partial SSR streaming |
| `TypedEventTarget` | class | Typed event target for granular updates |
| `addEventListeners` | function | Auto-cleanup event subscription |
| `attrs` | function | Attribute mixin |
| `clientEntry` | function | Mark component for client hydration |
| `createElement` | function | JSX element factory |
| `createMixin` | function | Create custom mixin |
| `createRangeRoot` | function | Create range root |
| `createRoot` | function | Create root element |
| `createScheduler` | function | Create update scheduler |
| `css` | function | CSS mixin factory |
| `link` | function | Navigation link mixin |
| `navigate` | function | Programmatic navigation |
| `on` | function | Event listener mixin |
| `ref` | function | Ref mixin |
| `run` | function | Boot client hydration |

**Notably absent from exports**: `component` (the factory function does NOT exist), `Handle` (not a runtime export — import via `import { type Handle } from 'remix/ui'`)

### `Handle` Type

The `Handle` type **IS** importable from `remix/ui`:
```ts
import { type Handle } from 'remix/ui'
```
It is used internally by `clientEntry` to type the first parameter of client-entry component factories. But there is no `component()` wrapper to create components that receive a `Handle` outside of `clientEntry`.

## Theme Token Categories

| Category | Example Values |
|----------|---------------|
| `space` | `none`, `px`, `xs`, `sm`, `md`, `lg`, `xl`, `xxl` |
| `radius` | `none`, `sm`, `md`, `lg`, `xl`, `full` |
| `fontSize` | `xxxs`, `xxs`, `xs`, `sm`, `md`, `lg`, `xl`, `xxl` |
| `lineHeight` | `tight`, `normal`, `relaxed` |
| `fontWeight` | `normal`, `medium`, `semibold`, `bold` |
| `shadow` | `xs`, `sm`, `md`, `lg`, `xl` |
| `zIndex` | `dropdown`, `popover`, `sticky`, `overlay`, `modal`, `toast`, `tooltip` |
| `surface` | `lvl0`–`lvl4` |
| `colors.text` | `primary`, `secondary`, `muted`, `link` |
| `colors.border` | `subtle`, `default`, `strong` |
| `colors.focus` | `ring` |
| `colors.overlay` | `scrim` |
| `colors.action` | `primary.*`, `secondary.*`, `danger.*` |

## First-Party Components

- `Button` — tones: `primary`, `secondary`, `danger`; supports `startIcon`
- `Menu`
- `Listbox`
- `Popover`
- `Select`

## Key APIs

- **`createTheme(config)`** → `ThemeComponent` — define typed token contract
- **`css(styleObj)`** → `Mixin` — create a CSS mixin from style object
- **`theme`** — typed consumption object (resolves to `var(--rmx-...)`)
- **`createGlyphSheet(glyphs)`** → `GlyphSheetComponent` — create hidden SVG sprite sheet

**Reference**: `packages/ui/README.md`

**Related**:
- concepts/theme-contract.md — Theme contract deep dive
- concepts/glyph-system.md — Glyph system deep dive
- guides/ui-setup.md — UI package setup guide
