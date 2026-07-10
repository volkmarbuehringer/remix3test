---
name: remix3-svg-attributes
description: 'Remix 3 SVG attributes use kebab-case (not camelCase) — React conventions silently break'
user-invocable: false
origin: auto-extracted
---

# Remix 3 SVG Attributes Use Kebab-Case

**Extracted:** 2026-06-14
**Context:** Rendering SVG icons and graphics in Remix 3 using `remix/ui` JSX.

## Problem

SVG attributes written in React/Preact camelCase convention (`strokeWidth`, `strokeLinecap`, `strokeLinejoin`, `stopColor`) do not render in Remix 3's custom JSX. The browser receives the raw attribute name as-is, and SVG parsers expect lowercase kebab-case names.

Wrong (React convention, silently broken in Remix 3):

```tsx
<svg strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
  <stop stopColor="#6366f1" />
</svg>
```

## Solution

Use kebab-case for all SVG presentation attributes — the same convention as writing SVG in HTML:

```tsx
<svg stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <stop stop-color="#6366f1" />
</svg>
```

Full list of commonly affected attributes:

| React camelCase    | Remix 3 kebab-case  |
| ------------------ | ------------------- |
| `strokeWidth`      | `stroke-width`      |
| `strokeLinecap`    | `stroke-linecap`    |
| `strokeLinejoin`   | `stroke-linejoin`   |
| `strokeMiterlimit` | `stroke-miterlimit` |
| `fillOpacity`      | `fill-opacity`      |
| `strokeOpacity`    | `stroke-opacity`    |
| `strokeDasharray`  | `stroke-dasharray`  |
| `stopColor`        | `stop-color`        |
| `stopOpacity`      | `stop-opacity`      |
| `clipRule`         | `clip-rule`         |
| `fillRule`         | `fill-rule`         |

## Why

Remix 3 uses its own JSX runtime (`remix/ui`) that does not go through React's attribute name translation. React normalizes SVG attributes from camelCase to their native HTML/SVG lowercase form; Remix 3 passes attributes through verbatim. SVG is case-sensitive — the browser's SVG parser only recognizes the lowercase kebab-case forms defined in the SVG specification.

## When to Use

- Rendering inline SVG elements in Remix 3 components
- Migrating SVG code from React projects
- SVG icons, illustrations, or decorative graphics not rendering visually without errors
