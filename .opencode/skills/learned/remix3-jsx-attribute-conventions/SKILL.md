---
name: remix3-jsx-attribute-conventions
description: 'Remix 3 remix/ui JSX passes attributes through verbatim — use kebab-case for SVG, and verify runtime attribute renames (rmx-* → data-rmx-*) at the runtime layer, not tsc/render tests'
origin: consolidated
---

# Remix 3 JSX Attribute Conventions

**Consolidated from:** `remix3-svg-attributes`, `remix3-jsx-attribute-rename-blind-spot`

Remix 3 uses its own JSX runtime (`remix/ui`, `jsxImportSource: "remix/ui"`), not React. It passes attributes through **verbatim** — there is no React-style attribute-name translation. Two consequences follow, both silent breakages:

1. SVG presentation attributes must be written in **kebab-case** (the SVG spec's lowercase form), not React camelCase.
2. Because JSX props are typed as `Record<string, any>`, attribute renames/typos **compile without error** — verify runtime attribute contracts at the runtime layer, not via `tsc` or render assertions.

---

## Part 1: SVG Attributes Use Kebab-Case

### Problem

SVG attributes written in React/Preact camelCase convention (`strokeWidth`, `strokeLinecap`, `strokeLinejoin`, `stopColor`) do not render in Remix 3's custom JSX. The browser receives the raw attribute name as-is, and SVG parsers expect lowercase kebab-case names.

Wrong (React convention, silently broken in Remix 3):

```tsx
<svg strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
  <stop stopColor="#6366f1" />
</svg>
```

### Solution

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

### Why

Remix 3's JSX runtime passes attributes through verbatim; React normalizes SVG attributes from camelCase to their native HTML/SVG lowercase form. SVG is case-sensitive — the browser's SVG parser only recognizes the lowercase kebab-case forms defined in the SVG specification.

---

## Part 2: Attribute Renames Are Invisible to Typecheck & Render Tests

### Problem

`remix/ui`'s automatic JSX runtime types the `jsx()` factory's props as `ElementProps = Record<string, any>` (`packages/ui/src/runtime/jsx.d.ts`). So **every attribute is accepted** on any intrinsic element — the strict `IntrinsicElements` prop types (e.g. `FormHTMLProps` with `data-rmx-target`) are never enforced on JSX.

Consequences:
- Attribute renames, typos, or removed attributes **compile without error**
- Render-based tests (server-render assertions checking the emitted tree/HTML) **also pass**, because they assert what the component *emits*, not what the runtime *reads*
- The breakage is invisible until you exercise the actual browser runtime

**Real-world example:** The upstream `remix`/`@remix-run/ui` runtime renamed frame-navigation attributes from `rmx-*` to `data-rmx-*` (commit `0839bbf77`, `remix@3.0.0-beta.11`). The app still emitted bare `rmx-*` in 129 places and typecheck + all tests passed — the frame navigation was silently dead.

### Solution

When a runtime contract changes (attribute renamed, prop removed), verify at the **runtime** layer, not via `tsc` or render assertions:

1. **Confirm the installed runtime's actual behavior** — grep the installed package, not the source:
   ```bash
   rg -n "getAttribute\('data-rmx" node_modules/@remix-run/ui/dist/runtime/navigation.js
   ```
2. **Sweep for stale attributes** with a negative-lookbehind regex (excludes already-renamed `data-rmx-*`):
   ```bash
   rg -n '(?<!data-)rmx-(target|src|document|history|reset-scroll|preserve-dom)' app/ -P
   ```
3. **Add a focused render test** asserting the *new* attribute name is emitted (catches regressions at the render layer).
4. **Exercise the real flow in a browser** (e2e or manual) — the only layer that proves the runtime reads the attribute.

---

## When to Use

- Rendering inline SVG elements in Remix 3 components (migrating SVG from React, or icons not rendering)
- Upstream `remix`/`@remix-run/ui` renames, removes, or adds a runtime attribute
- A `data-rmx-*` / `rmx-*` / `ln-*` attribute appears dead (frame targeting, document escape, or history semantics not working)
- Diagnosing "tests pass but feature silently broken" in a Remix 3 frame app
- Before trusting `npm run typecheck` after bumping the pinned `remix` build (`github:remix-run/remix#preview/main`)
