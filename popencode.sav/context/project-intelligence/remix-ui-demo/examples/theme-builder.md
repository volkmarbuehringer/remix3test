---
title: Theme Builder
description: Interactive theme editor with live preview, token controls, and component gallery
category: project-intelligence
type: example
source: app/theme-builder.tsx, app/theme-builder-view.tsx, app/theme-builder-controller.tsx
---

# Theme Builder

## Core Concept

An interactive tool for editing `RMX_01` theme values with live preview, component gallery, and theme file download.

## Three-Layer Architecture

| Layer | File | Role |
|-------|------|------|
| Controller | `theme-builder-controller.tsx` | Renders the `ThemeBuilderDocument` via SSR |
| View | `theme-builder-view.tsx` | Full HTML document shell with `clientEntry` for hydration |
| Logic | `theme-builder.tsx` | Token state management, control rendering, component gallery |

## Token Controls

Token values are discovered dynamically by `flattenThemeTokens()`. Controls are grouped by accordion sections:

- **Input types**: `color` (hex preview + picker), `range` (slider for px/em/number values), `text` (direct input)
- **Range detection**: Numeric values get `0-100` sliders; `px` values get context-aware max; `em`, `lineHeight`, `fontWeight` get tailored ranges
- **State**: `values` object cloned via `JSON.parse(JSON.stringify(...))` on each update

## Live Preview

```tsx
let PreviewTheme = createTheme(values, {
  reset: false,
  selector: '[data-theme-preview]',
})
```

The `<PreviewTheme />` component is rendered inside the `data-theme-preview` container, wrapping the `ComponentGallery`.

## Component Gallery

Shows 7 components in a responsive card grid: Button (primary/secondary/ghost/danger), Breadcrumbs, Accordion, Select, Combobox, Listbox, Menu (static with submenu), Popover (interactive with anchor/surface).

## Download

Generates a TypeScript file with `createTheme(...)` call and current values:

```tsx
let file = new Blob([createThemeFile(values)], { type: 'text/typescript;charset=utf-8' })
// Creates downloadable theme.ts
```

## References

- `app/theme-builder.tsx` — Main component: state, controls, gallery, CSS
- `app/theme-builder-view.tsx` — Document shell with `clientEntry`
- `app/theme-builder-controller.tsx` — Controller handler
