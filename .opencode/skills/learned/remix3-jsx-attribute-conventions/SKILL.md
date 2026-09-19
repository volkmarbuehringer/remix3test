---
name: remix3-jsx-attribute-conventions
description: "Use when writing Remix 3 `remix/ui` JSX — attributes pass through verbatim (use kebab-case for SVG), and runtime renames (`rmx-*` → `data-rmx-*`) must be verified at runtime, not tsc."
origin: consolidated
---

# Remix 3 JSX Attribute Conventions

**Consolidated from:** `remix3-svg-attributes`, `remix3-jsx-attribute-rename-blind-spot`

This skill is the **index** for the consolidated JSX attribute conventions. Read only the reference you need.

## Load Only The References You Need

| Task involves... | Start with |
| --- | --- |
| Writing inline SVG in Remix 3 — React camelCase attributes not rendering | `references/svg-attributes-kebab-case.md` |
| An `rmx-*` runtime attribute appears dead, or an upstream runtime renames/removes an attribute | `references/attribute-renames-runtime-verification.md` |

## Core Rules

Remix 3 uses its own JSX runtime (`remix/ui`, `jsxImportSource: "remix/ui"`), not React. It passes attributes through **verbatim** — there is no React-style attribute-name translation. Two consequences follow, both silent breakages:

1. SVG presentation attributes must be written in **kebab-case** (the SVG spec's lowercase form), not React camelCase.
2. Because JSX props are typed as `Record<string, any>`, attribute renames/typos **compile without error** — verify runtime attribute contracts at the runtime layer, not via `tsc` or render assertions.

- **Kebab-case SVG**: `stroke-width`, `stroke-linecap`, `stroke-linejoin`, `stop-color`, `fill-rule`, etc. — see the full mapping in `references/svg-attributes-kebab-case.md`.
- **`ElementProps = Record<string, any>`**: strict `IntrinsicElements` prop types (e.g. `FormHTMLProps` with `data-rmx-target`) are never enforced on JSX, so renames and typos pass typecheck; server-render tests pass too because they assert what a component *emits*, not what the runtime *reads*. See `references/attribute-renames-runtime-verification.md`.
- **Verify at the runtime layer**: grep the installed package for the actual attribute, sweep the app with a negative-lookbehind regex, add a render test for the new name, and exercise the real flow in a browser.

## When to Use

- Rendering inline SVG elements in Remix 3 components (migrating SVG from React, or icons not rendering)
- Upstream `remix`/`@remix-run/ui` renames, removes, or adds a runtime attribute
- A `data-rmx-*` / `rmx-*` / `ln-*` attribute appears dead (frame targeting, document escape, or history semantics not working)
- Diagnosing "tests pass but feature silently broken" in a Remix 3 frame app
- Before trusting `npm run typecheck` after bumping the pinned `remix` build (`github:remix-run/remix#preview/main`)
