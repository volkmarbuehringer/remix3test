<!-- Context: project-intelligence/newapp/guides/breadcrumb-pattern | Priority: high | Version: 1.0 | Updated: 2026-05-13 -->

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

`app/ui/breadcrumbs.tsx`:

```tsx
import { Breadcrumbs } from 'remix/ui/breadcrumbs'
import type { BreadcrumbItem } from 'remix/ui/breadcrumbs'

export { Breadcrumbs }
export type { BreadcrumbItem }

export function getBreadcrumbs(pathname: string): BreadcrumbItem[] {
  let path = pathname.replace(/\/+$/, '') || '/'

  if (path === '/') return [{ label: 'Home' }]
  if (path === '/login') return [{ href: '/', label: 'Home' }, { label: 'Login' }]
  if (path === '/register') return [{ href: '/', label: 'Home' }, { label: 'Register' }]

  if (path === '/ai') return [{ href: '/', label: 'Home' }, { label: 'AI Dashboard' }]
  if (path.startsWith('/ai/')) {
    let sub = path.slice(4)
    let pageLabels: Record<string, string> = {
      chat: 'Chat', agent: 'Agent', workflow: 'Workflows',
    }
    let label = pageLabels[sub]
    if (label) return [
      { href: '/', label: 'Home' },
      { href: '/ai', label: 'AI' },
      { label },
    ]
  }

  if (path === '/admin') return [{ href: '/', label: 'Home' }, { label: 'Admin Dashboard' }]
  if (path.startsWith('/admin/')) {
    let sub = path.slice(7)
    let pageLabels: Record<string, string> = {
      chatlog: 'Chat Logs', messages: 'Messages',
    }
    let label = pageLabels[sub] ?? pageLabels[sub.split('/')[0]!]
    if (label) return [
      { href: '/', label: 'Home' },
      { href: '/admin', label: 'Admin' },
      { label },
    ]
  }

  // Fallback
  return [{ label: 'Home' }]
}
```

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

## Pattern: Path Prefix Matching

The breadcrumb mapping uses **prefix matching** rather than route registry lookups:

```tsx
if (path.startsWith('/admin/')) { ... }
```

This means breadcrumbs work without needing to import the route registry — they're decoupled from `app/routes.ts`. The tradeoff is that the breadcrumb mapping needs manual updates when new routes are added.

## Adding Breadcrumbs for a New Section

1. Add a path check in `getBreadcrumbs()`:
   ```tsx
   if (path === '/settings') return [{ href: '/', label: 'Home' }, { label: 'Settings' }]
   if (path.startsWith('/settings/')) { ... }
   ```
2. If the section has its own layout shell, add `<Breadcrumbs>` to that shell
3. If using the main Layout, breadcrumbs render automatically

## When to Create Section-Specific Breadcrumbs

- **Simple section** (1-2 pages): Add mapping to the existing `getBreadcrumbs()` function
- **Complex section** (many sub-routes): Consider extracting a dedicated breadcrumb function for that section (e.g., `getSettingsBreadcrumbs(path)`)

## 📂 Codebase References

- **Breadcrumb utility**: `app/ui/breadcrumbs.tsx` — `getBreadcrumbs()` path-to-trail mapping
- **Breadcrumb component**: `remix/ui/breadcrumbs` — `Breadcrumbs` component (re-exported)
- **Consumer**: `app/ui/layout.tsx` — Breadcrumbs in main layout
- **Consumer**: `app/ui/ai-layout.tsx` — Breadcrumbs in AI sidebar shell
- **Consumer**: `app/ui/admin-layout.tsx` — Breadcrumbs in Admin sidebar shell

## Related

- [Breadcrumbs (remix3)](../../development/remix3/ui/guides/breadcrumbs.md) — Generic breadcrumbs component guide
- [App architecture](../concepts/architecture.md) — Layout hierarchy
- [Admin frame-nav pattern](./admin-frame-nav-pattern.md) — Admin shell uses breadcrumbs
