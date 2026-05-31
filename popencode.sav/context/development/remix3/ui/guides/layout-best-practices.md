<!-- Context: development/remix3/ui/guides/layout-best-practices | Priority: medium | Version: 1.1 | Updated: 2026-05-11 -->

# Layout Best Practices

Common layout patterns and HTML head configuration for Remix 3 applications.

## Favicon

Always include a favicon to prevent 404 errors in browser console.

### SVG Favicon

```svg
<!-- public/favicon.svg -->
<svg width="32" height="32" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
  <rect width="32" height="32" rx="6" fill="#2563eb"/>
  <path d="M8 10h16M8 16h12M8 22h8" stroke="white" stroke-width="2.5" stroke-linecap="round"/>
</svg>
```

```tsx
// app/ui/layout.tsx
<head>
  <meta charSet="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>{title} | App</title>
  <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
  <script async type="module" src="/assets/entry.js" />
</head>
```

**Note**: Static files in `public/` served via `staticFiles('./public', {...})` middleware.

## Conditional Navigation

Show nav items based on user permissions:

```tsx
// app/ui/layout.tsx
import type { Handle } from 'remix/ui'

type LayoutProps = {
  title: string
  activeNav?: MainNavItem
  isAdmin?: boolean
  children?: RemixNode
}

const baseNavItems = [
  { id: 'dashboard', label: 'Dashboard', route: routes.main.index },
  { id: 'courses', label: 'Courses', route: routes.main.courses },
]
const adminNavItem = { id: 'admin', label: 'Admin', route: routes.admin.index }

export function Layout(handle: Handle<LayoutProps>) {
  return () => {
    let { title, activeNav, isAdmin, children } = handle.props
    let navItems = isAdmin ? [...baseNavItems, adminNavItem] : baseNavItems
    // ... render with navItems
  }
}
```

### Pass isAdmin from Controllers

```tsx
// app/controllers/main/controller.tsx
function renderMainPage(title: string, activeNav: MainNavItem, isAdmin: boolean, content: RemixNode) {
  return render(
    <Layout title={title} activeNav={activeNav} isAdmin={isAdmin}>{content}</Layout>,
  )
}

export default {
  actions: {
    index() {
      let currentUser = getCurrentUser()
      let isAdmin = currentUser?.is_admin === true
      return renderMainPage('Dashboard', 'dashboard', isAdmin, <Page />)
    },
  },
}
```

## Typed Nav Registry

For larger apps, evolve from inline nav arrays to a single-source-of-truth typed registry. Centralizes nav structure, enables computed active states, and keeps templates unchanged when adding pages.

```tsx
// app/ui/nav.ts — types + registry in one file
export type NavItem = { label: string; href: string; adminOnly?: boolean }
export type NavSection = { id: string; label?: string; items: NavItem[] }

export const NAV_SECTIONS = [
  { id: 'main', items: [
    { label: 'Home', href: '/' },
    { label: 'Products', href: '/products' },
  ]},
  { id: 'admin', label: 'Admin', items: [
    { label: 'Dashboard', href: '/admin' },
  ]},
] as const satisfies readonly NavSection[]
```

- **`as const satisfies`** gives type safety + literal `href` types
- **Active state**: `let isActive = (path: string) => currentPath === path || currentPath.startsWith(path + '/')`
- **Rendering**: `NAV_SECTIONS.flatMap(s => s.items).map(item => <a href={item.href} class={isActive(item.href) ? 'nav-active' : undefined}>{item.label}</a>)`
- **Add a page**: One array entry, no template edits
- **Role filter**: `NAV_SECTIONS.map(s => ({ ...s, items: s.items.filter(it => !it.adminOnly || isAdmin) }))`

## HTML Head

### Required

```tsx
<head>
  <meta charSet="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>{title} | App</title>
  <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
  <script async type="module" src="/assets/entry.js" />
</head>
```

### Optional

```tsx
<meta name="description" content={description} />
<meta name="theme-color" content="#2563eb" />
<meta property="og:title" content={title} />
```

## Common Mistakes

- **Missing favicon**: 404 errors, unprofessional tab appearance
- **Wrong isAdmin**: Use `=== true`, not `=== 1` (boolean, not integer)
- **Missing isAdmin prop**: Controllers must pass to Layout

## Related

- `layout.md` - Sidebar layouts
- `design-system.md` - CSS theming