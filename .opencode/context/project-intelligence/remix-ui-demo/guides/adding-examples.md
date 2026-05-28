---
title: Adding Examples
description: How to add new examples to the demo — file naming, metadata, auto-discovery
category: project-intelligence
type: guide
source: app/examples/discovery.ts, app/examples/index.tsx, app/examples/components/
---

# Adding Examples

## Core Concept

Create a `.tsx` file in one of the example subdirectories (`components/`, `foundations/`, `theme/`, `ui-tokens/`). Add metadata in `EXAMPLE_COPY_BY_SLUG`. The file is auto-discovered at startup.

## Steps

### 1. Create the file

Place a `.tsx` file in the appropriate directory:

| Directory | Purpose |
|-----------|---------|
| `components/` | Component demos (accordion, combobox, etc.) |
| `foundations/` | Theme setup and installation |
| `theme/` | Theme token documentation |
| `ui-tokens/` | Component styling contracts |

**Naming**: Use kebab-case for the slug (e.g., `my-new-example.tsx`). The file must `default export` a component function.

### 2. Add metadata

Add an entry in `EXAMPLE_COPY_BY_SLUG` (in `app/examples/index.tsx`):

```tsx
'my-new-example': {
  description: 'What this example demonstrates.',
  title: 'My New Example',
}
```

Optional overrides:
- `id` — custom camelCase identifier (default: auto-generated from slug)
- `slug` — custom URL slug (default: filesystem basename)

### 3. Auto-discovery behavior

The system ignores files starting with `_` or `.`, `controller.tsx`, `index.tsx`, `view.tsx`, and non-`.tsx` files. If a metadata entry exists but no matching file is found, the app throws at startup (and vice versa — files without metadata get auto-generated titles).

### 4. Slug → ID mapping

```tsx
// slug: 'my-new-example' → id: 'myNewExample'
toExampleId(slug) // camelCase conversion
```

### 5. Verification

Run the app — missing files for configured slugs produce a clear error:
```
Configured example copy for missing example "my-new-example"
```

## References

- `app/examples/discovery.ts` — `walkExampleFiles`, `shouldIgnoreEntry`, `toExampleId`
- `app/examples/index.tsx` — `EXAMPLE_COPY_BY_SLUG`, `createExampleEntry`, `loadExampleModule`
