<!-- Context: project-intelligence/newapp/guides/admin-frame-nav-pattern | Priority: high | Version: 1.0 | Updated: 2026-05-13 -->

# Guide: Admin & AI Frame-Nav Sidebar Pattern

**Core Idea**: Admin and AI sections use a consistent sidebar pattern with grouped nav items (`NAV_GROUPS`), frame-based navigation via `rmx-target`, and a shell-or-fragment pattern that detects `X-Remix-Target` to render either a full-page shell or a frame fragment.

---

## Pattern Overview

Both Admin and AI sections follow the same architecture:

```
Top-level request (no X-Remix-Target header)
  → Layout + <Frame name="admin-content" src="/admin/chatlog">
  → Frame fetches /admin/chatlog with X-Remix-Target: admin-content
  → Shell detects header → renders sidebar + content (no outer Layout)

Frame request (X-Remix-Target: admin-content)
  → AdminLayout (sidebar + breadcrumbs + content)
```

## 1. Sidebar with NAV_GROUPS

Both layouts define a typed nav item ID and group structure:

```tsx
// Admin (app/ui/admin-layout.tsx)
export type AdminNavItem = 'dashboard' | 'chatlog' | 'chatonly' | 'agentonly' | 'messages' | 'lists' | 'client'

const NAV_GROUPS: NavGroup[] = [
  {
    items: [
      { id: 'dashboard', label: 'Dashboard', route: routes.admin.index },
    ],
  },
  {
    label: 'Data',
    items: [
      { id: 'chatlog', label: 'Chat Logs', route: routes.admin.chatlog.index },
      { id: 'chatonly', label: 'Chat Only', href: '/admin/chatlog?type=chat' },
      { id: 'agentonly', label: 'Agent Only', href: '/admin/chatlog?type=agent' },
      { id: 'messages', label: 'Messages', route: routes.admin.messages.index },
      { id: 'lists', label: 'Lists', href: '/lists', iframeNav: false },
      { id: 'client', label: 'Client Lab', href: '/client', iframeNav: false },
    ],
  },
]

// AI (app/ui/ai-layout.tsx)
export type AiNavItem = 'dashboard' | 'chat' | 'agent' | 'workflow'

const NAV_GROUPS: NavGroup[] = [
  {
    items: [
      { id: 'dashboard', label: 'Dashboard', route: routes.ai.index },
    ],
  },
  {
    label: 'AI Tools',
    items: [
      { id: 'chat', label: 'Chat', route: routes.ai.chat.index },
      { id: 'agent', label: 'Agent', route: routes.ai.agent.index },
      { id: 'workflow', label: 'Workflows', route: routes.ai.workflow.index },
    ],
  },
]
```

## 2. Frame Navigation via `rmx-target`

Nav items use `rmx-target` attribute to navigate within the content frame:

```tsx
<a
  href={item.href ?? item.route?.href() ?? '#'}
  {...(item.iframeNav !== false ? { 'rmx-target': frames.adminContent } : { target: '_top' })}
>
```

- **`rmx-target="admin-content"`**: Navigation loads inside the content frame (default)
- **`target="_top"`** or `iframeNav: false`: Full-page navigation (used for Lists, Client Lab which don't support frames)

The frame name (`frames.adminContent = 'admin-content'`) is defined in `app/routes.ts`:

```tsx
export const frames = {
  adminContent: 'admin-content',
  aiContent: 'ai-content',
  clientGrid: 'client-grid',
} as const
```

## 3. Shell-or-Fragment Pattern

Both layouts use a three-function structure:

| Function | Purpose |
|----------|---------|
| `renderAdminPage(render, activeItem, content, init)` | Public API — wraps content in shell-or-fragment |
| `AdminShellOrFragment(handle)` | Detects frame vs top-level request |
| `AdminLayout(handle)` | Renders sidebar + breadcrumbs + content (frame fragment) |

```tsx
export function renderAdminPage(
  render: (node: RemixNode, init?: ResponseInit) => Response,
  activeItem: AdminNavItem,
  content: RemixNode,
  init?: ResponseInit,
) {
  return render(
    <AdminShellOrFragment activeItem={activeItem}>{content}</AdminShellOrFragment>,
    init,
  )
}

function AdminShellOrFragment(handle: Handle<AdminPageProps>) {
  return () => {
    let { activeItem, children } = handle.props
    if (isAdminFrameRequest()) {
      return <AdminLayout activeItem={activeItem}>{children}</AdminLayout>
    }
    // Top-level: wrap in outer Layout with a Frame
    return (
      <Layout>
        <Frame name={frames.adminContent} src={getContext().request.url} />
      </Layout>
    )
  }
}

function isAdminFrameRequest(): boolean {
  return getContext().request.headers.get('X-Remix-Target') === frames.adminContent
}
```

## 4. Controller Integration

Controllers use `renderAdminPage()` / `renderAiPage()` instead of direct `render()`:

```tsx
// app/actions/admin-controller.tsx
export default createController<typeof routes.admin, AppContext>(routes.admin, {
  middleware: [requireAuth(), requireAdmin()],
  actions: {
    index({ get }) {
      return renderAdminPage(get(Renderer), 'dashboard', <AdminDashboardContent />)
    },
  },
})

// app/actions/ai-controller.tsx
export default createController<typeof routes.ai, AppContext>(routes.ai, {
  middleware: [requireAuth()],
  actions: {
    index({ get }) {
      return renderAiPage(get(Renderer), 'dashboard', <AiDashboardContent />)
    },
  },
})
```

## 5. Consistent Layout with Breadcrumbs

Both sidebars include breadcrumbs above the content area:

```tsx
<section mix={adminContentStyle}>
  <Breadcrumbs items={getBreadcrumbs(new URL(getContext().request.url).pathname)} />
  {children}
</section>
```

## Nav Item Type

```tsx
type NavItem = {
  id: AdminNavItem | AiNavItem    // Typed literal union
  label: string
  route?: { href: () => string }   // Route reference from app/routes.ts
  href?: string                     // Direct URL (for filtered variants like ?type=chat)
  iframeNav?: boolean               // Default true; false = full page navigation
}
```

## Comparison: Admin vs AI

| Aspect | Admin | AI |
|--------|-------|----|
| NavItem type | `AdminNavItem` | `AiNavItem` |
| Auth middleware | `requireAuth() + requireAdmin()` | `requireAuth()` |
| Frame name | `admin-content` | `ai-content` |
| Frame constant | `frames.adminContent` | `frames.aiContent` |
| Render function | `renderAdminPage()` | `renderAiPage()` |
| Layout function | `AdminLayout()` | `AiLayout()` |
| Shell function | `AdminShellOrFragment()` | `AiShellOrFragment()` |
| Frame detection | `isAdminFrameRequest()` | `isAiFrameRequest()` |
| Nav groups | Dashboard, Data | Dashboard, AI Tools |

## Adding a New Item to Admin/AI Nav

1. Add the ID to the typed union (`AdminNavItem` or `AiNavItem`)
2. Add nav icon case in `navIcon()` function
3. Add the item to `NAV_GROUPS` with `route` or `href`
4. If the target doesn't support frames, set `iframeNav: false`

## 📂 Codebase References

- **Admin layout**: `app/ui/admin-layout.tsx` — NAV_GROUPS, renderAdminPage, AdminShellOrFragment, AdminLayout
- **AI layout**: `app/ui/ai-layout.tsx` — Parallel implementation for AI section
- **Admin controller**: `app/actions/admin-controller.tsx` — Uses renderAdminPage
- **AI controller**: `app/actions/ai-controller.tsx` — Uses renderAiPage
- **Frame constants**: `app/routes.ts` — `frames` object with frame names
- **Breadcrumbs**: `app/ui/breadcrumbs.tsx` — getBreadcrumbs() used in both shells

## Related

- [Frame navigation patterns (remix3)](../../development/remix3/guides/frame-navigation-patterns.md) — Frame detection, X-Remix-Target, named frames
- [Breadcrumb pattern](./breadcrumb-pattern.md) — Breadcrumb integration in both shells
- [Auth redirect flow](./auth-redirect-flow.md) — requireAuth() used by admin controller
- [Nav registry](./nav-registry.md) — Main nav bar (separate from sidebar)
