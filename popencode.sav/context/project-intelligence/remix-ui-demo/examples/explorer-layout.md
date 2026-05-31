---
title: Explorer Layout
description: Two-column layout with sticky sidebar, page header, and responsive behavior
category: project-intelligence
type: example
source: app/explorer/view.tsx, app/explorer/page-primitives.tsx, app/explorer/example-card.tsx
---

# Explorer Layout

## Core Concept

The explorer uses a two-column grid layout with a 320px sticky sidebar for navigation and a fluid main content area capped at 750px.

## Layout Structure

```
┌─────────────────────────────────────────┐
│  Sidebar (320px, sticky)  │ Main (fluid) │
│  ┌──────────────────────┐ │ ┌──────────┐ │
│  │ Preview Doc title    │ │ │ Eyebrow  │ │
│  │ ──────────────────── │ │ │ Title    │ │
│  │ Start                │ │ │ Desc     │ │
│  │  • Conceptual Overv. │ │ │          │ │
│  │  • Installing Theme  │ │ │ Page     │ │
│  │  • Creating Theme    │ │ │ Content  │ │
│  │ Theme Tokens         │ │ │ (max     │ │
│  │  • Colors            │ │ │  750px)  │ │
│  │  • Spacing           │ │ │          │ │
│  │ Components           │ │ │          │ │
│  │  • Accordion         │ │ │          │ │
│  │  • Breadcrumbs       │ │ │          │ │
│  │  • ...               │ │ │          │ │
│  └──────────────────────┘ │ └──────────┘ │
└─────────────────────────────────────────┘
```

## Key Details

- **Sidebar**: `position: sticky; top: 0; height: 100vh; overflow-y: auto; padding: theme.space.xl`. Uses `aria-current="page"` for active nav state.
- **Main**: `padding: theme.space.xxl; max-width: 750px` centered via `margin-inline: auto`.
- **Responsive**: At `980px` breakpoint, the grid collapses to single column, sidebar becomes static with bottom border.

## Page Header

Each page shows eyebrow (e.g., "Component"), title, and description. Rendered by `PageHeader` component.

## ExplorerExampleCard

```tsx
<Frame src={getExampleContentHref(example, { ... })} />
```

Wraps examples in a `<Frame>` for SSR'd live preview embedded in explorer pages.

## Shared Primitives

`app/explorer/page-primitives.tsx` exports reusable components:
- `PageSection` — titled section wrapper
- `ShowcaseLinkCard` — navigation card with eyebrow/title/description
- CSS exports: `panelCss`, `eyebrowTextCss`, `bodyTextCss`, `pageStackCss`, `featureGridCss`, `exampleGridCss`, `tokenGroupGridCss`

## References

- `app/explorer/view.tsx` — `ExplorerDocument`, `Sidebar`, `PageHeader`, layout CSS
- `app/explorer/page-primitives.tsx` — Shared panel/section components and styles
- `app/explorer/example-card.tsx` — Frame-based example card embedding
- `app/explorer/registry.tsx` — `NAV_SECTIONS` and page definitions
