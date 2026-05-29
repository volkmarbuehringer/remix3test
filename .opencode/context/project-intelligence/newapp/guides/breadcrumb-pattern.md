<!-- Context: project-intelligence/newapp/guides/breadcrumb-pattern | Priority: high | Version: 2.0 | Updated: 2026-05-29 -->

# Guide: Breadcrumb Pattern

**Core Idea**: `app/ui/breadcrumbs.tsx` exports both the `Breadcrumbs` component (re-exported from `remix/ui/breadcrumbs`) and a `getBreadcrumbs()` utility that maps URL pathnames to breadcrumb trails. The trail is rendered in the Layout, AI shell, and Admin shell — no per-page breadcrumb code needed.

---

## Architecture

```
Pathname (e.g., "/admin/chatlog")
  → getBreadcrumbs(pathname)
  → BreadcrumbItem[] (e.g., [{href:'/', label:'Home'}, {href:'/admin', label:'Admin'}, {label:'Chat Logs'}])
  → <Breadcrumbs items={...} />
```

The last item in the array has no `href` — it represents the current page. This is the `remix/ui/breadcrumbs` convention.

## The `getBreadcrumbs()` Utility

`app/ui/breadcrumbs.tsx` delegates label resolution to the centralized `ROUTE_LABELS` map at `app/ui/route-labels.ts`:

```tsx
import { Breadcrumbs } from 'remix/ui/breadcrumbs'
import type { BreadcrumbItem } from 'remix/ui/breadcrumbs'

import { ROUTE_LABELS } from './route-labels.ts'

export { Breadcrumbs }
export type { BreadcrumbItem }

export function getBreadcrumbs(pathname: string): BreadcrumbItem[] {
  let path = pathname.replace(/\/+$/, '') || '/'

  // Exact match — build hierarchical trail from root segments
  let exactLabel = ROUTE_LABELS[path]
  if (exactLabel) {
    return buildTrail(path, exactLabel)
  }

  // Partial match — walk up to nearest parent path with a label
  let segments = path.split('/').filter(Boolean)
  for (let i = segments.length - 1; i >= 0; i--) {
    let parentPath = '/' + segments.slice(0, i).join('/')
    let parentLabel = ROUTE_LABELS[parentPath]
    if (parentLabel) {
      return buildTrail(parentPath, parentLabel)
    }
  }

  // Fallback
  return [{ label: 'Home' }]
}

function buildTrail(path: string, leafLabel: string): BreadcrumbItem[] {
  if (path === '/') {
    return [{ label: leafLabel }]
  }

  let segments = path.split('/').filter(Boolean)
  let trail: BreadcrumbItem[] = []

  // Accumulate path segments from root to leaf
  let current = ''
  for (let i = 0; i < segments.length; i++) {
    current += '/' + segments[i]
    let label = ROUTE_LABELS[current]
    if (label) {
      let isLast = i === segments.length - 1
      trail.push(isLast ? { label } : { href: current, label })
    }
  }

  return trail
}
```

Key behaviors:
- **Exact match**: If the pathname has a direct entry in `ROUTE_LABELS`, `buildTrail()` walks the path segments to build a hierarchical trail (e.g., `/admin/chatlog` yields `Home → Admin → Chat Logs`)
- **Partial match (fallback)**: If no exact match exists, the function walks up parent paths until it finds a label. This means sub-pages like `/admin/nutzer/42` inherit the `/admin/nutzer` label.
- **Fallback**: If no label is found for any parent segment, returns `[{ label: 'Home' }]`

## The `ROUTE_LABELS` Map (Single Source of Truth)

`app/ui/route-labels.ts` is a `Record<string, string>` mapping canonical URL paths to display labels. This is the **single place** where breadcrumb labels are defined:

```tsx
export const ROUTE_LABELS: Record<string, string> = {
  '/': 'Home',
  '/login': 'Login',
  '/admin': 'Admin Dashboard',
  '/admin/nutzer': 'Nutzer',
  '/admin/offerings': 'Leistungen',
  '/admin/appointments': 'Termine',
  '/appointment': 'Terminbuchung',
  '/ai': 'AI Dashboard',
  '/ai/workflow': 'Workflows',
  '/client': 'Client Lab',
  // ... see the full file for all entries
}
```

Adding a label for a new route is a one-line addition here — no `getBreadcrumbs()` changes needed.

## Where Breadcrumbs Render

Breadcrumbs appear in three locations:

| Location | File | Condition |
|----------|------|-----------|
| Main Layout | `app/ui/layout.tsx` | All standard pages above content |
| AI Shell (sidebar) | `app/ui/ai-layout.tsx` | Inside AI section, above content area |
| Admin Shell (sidebar) | `app/ui/admin-layout.tsx` | Inside Admin section, above content area |

All three use the same pattern:

```tsx
import { Breadcrumbs, getBreadcrumbs } from './breadcrumbs.tsx'

// Inside the render function:
let currentPath = new URL(getContext().request.url).pathname
// ...
<Breadcrumbs items={getBreadcrumbs(currentPath)} />
```

## Adding Breadcrumbs for a New Section

1. Add a `ROUTE_LABELS` entry in `app/ui/route-labels.ts`:
   ```tsx
   '/settings': 'Settings',
   ```
   Sub-pages with no exact label automatically inherit the parent label via `getBreadcrumbs()`'s partial-match fallback.

2. If the section has its own layout shell, add `<Breadcrumbs>` to that shell (import from `app/ui/breadcrumbs.tsx`).

3. If using the main Layout, breadcrumbs render automatically.

## When to Create Section-Specific Breadcrumbs

- **Simple section** (1-2 pages): Add an entry to `ROUTE_LABELS` — that's it
- **Complex section** (many sub-routes): The centralized map already handles this via partial matching. Only extract a dedicated breadcrumb function if the section needs custom trail logic (e.g., dynamic labels from route params)

## 📂 Codebase References

- **Route labels (source of truth)**: `app/ui/route-labels.ts` — `ROUTE_LABELS` map
- **Breadcrumb utility**: `app/ui/breadcrumbs.tsx` — `getBreadcrumbs()` path-to-trail resolver
- **Breadcrumb component**: `remix/ui/breadcrumbs` — `Breadcrumbs` component (re-exported)
- **Consumer**: `app/ui/layout.tsx` — Breadcrumbs in main layout
- **Consumer**: `app/ui/ai-layout.tsx` — Breadcrumbs in AI sidebar shell
- **Consumer**: `app/ui/admin-layout.tsx` — Breadcrumbs in Admin sidebar shell

## Related

- [Breadcrumbs (remix3)](../../development/remix3/ui/guides/breadcrumbs.md) — Generic breadcrumbs component guide
- [App architecture](../concepts/architecture.md) — Layout hierarchy
- [Admin frame-nav pattern](./admin-frame-nav-pattern.md) — Admin shell uses breadcrumbs
