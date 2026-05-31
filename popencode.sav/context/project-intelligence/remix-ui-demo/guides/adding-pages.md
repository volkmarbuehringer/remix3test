---
title: Adding Explorer Pages
description: How to add new pages to the explorer — registry entries, nav sections, route mapping
category: project-intelligence
type: guide
source: app/explorer/registry.tsx, app/explorer/controller.tsx, config/routes.ts
---

# Adding Explorer Pages

## Core Concept

Each explorer page is a `ShowcasePageDefinition` entry in the `PAGES` registry. The controller auto-generates actions and routes are mapped dynamically.

## Steps

### 1. Add a render function

Create a render function in `app/explorer/pages/` (e.g., `renderMyNewPage`). It returns a `RemixNode`.

### 2. Register the page in `PAGES`

```tsx
myNewPage: {
  actionKey: 'myNewPage',
  description: 'Description shown in page header.',
  eyebrow: 'Section Label',
  id: 'myNewPage',
  navLabel: 'Navigation Label',
  path: '/my-path',
  render: renderMyNewPage,
  sectionId: 'components', // 'start' | 'themeTokens' | 'components'
  title: 'My New Page',
}
```

### 3. Add to NAV_SECTIONS

```tsx
{
  id: 'components',
  label: 'Components',
  pageIds: [
    // ... existing entries ...
    'myNewPage',
  ],
}
```

### 4. Route mapping (automatic)

The controller (`app/explorer/controller.tsx`) iterates `PAGE_LIST` to create actions. Routes in `config/routes.ts` use `toRoutePath(page.path)` to generate `get()` handlers:

```tsx
const explorerRoutes = Object.fromEntries(
  PAGE_LIST.map((page) => [page.actionKey, get(toRoutePath(page.path))]),
)
```

### 5. Verify

- Page appears in the sidebar under its section
- Route is auto-mapped — no manual route addition needed
- `aria-current="page"` highlights are automatic via `isPageActive()`

## References

- `app/explorer/registry.tsx` — `PAGES`, `PAGE_LIST`, `NAV_SECTIONS`, `ShowcasePageDefinition`
- `app/explorer/controller.tsx` — Auto-generated actions from `PAGE_LIST`
- `config/routes.ts` — `explorerRoutes` dynamic route generation
