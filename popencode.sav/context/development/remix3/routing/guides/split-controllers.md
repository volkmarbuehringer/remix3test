<!-- Context: development/remix3/guides/split-controllers | Priority: high | Version: 1.1 | Updated: 2026-05-01 -->

# Split Controllers

Split large controllers by resource into separate files. Main controller imports and combines them.

## When to Split

- Controller exceeds 300 lines
- Multiple resources (posts, comments, users)
- Team collaboration on different resources

## Pattern

### 1. Split Controller File

```typescript
// app/posts/posts-controller.tsx
import type { RemixNode } from 'remix/ui'
import type { routes } from '../../routes.ts'
import type { BreadcrumbItem } from '../components/breadcrumbs.tsx'
import { PAGE_SIZE, toastRedirect } from '../lib/utils.ts'
import { posts, users } from '../data/schema.ts'

type RenderOptions = {
  title: string; content: RemixNode; activeNav: string
  toast?: string; toastError?: string; breadcrumbs?: BreadcrumbItem[]
}

// Shared layout renderer — injected by the main controller
let renderLayout: (opts: RenderOptions) => Response

export function initPostsController(render: (opts: RenderOptions) => Response) {
  renderLayout = render
}

// Action handlers exported individually — no `actions: {}` wrapper
// The main controller imports and maps them by route key
export async function postsIndex({ db, url }) {
  let page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10))
  let items = await db.findMany(posts, { orderBy: ['created_at', 'desc'], limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE })
  return renderLayout({ title: 'Posts', content: <ListPage items={items} />, activeNav: 'posts', breadcrumbs: [...] })
},
```

### 2. Main Controller

```typescript
// app/controller.tsx
import type { Controller } from 'remix/fetch-router'
import type { RemixNode } from 'remix/ui'
import type { routes } from '../../routes.ts'
import { render } from '../render.tsx'
import { AppLayout } from './layout.tsx'
import type { BreadcrumbItem } from '../components/breadcrumbs.tsx'
import { initPostsController, postsIndex, postsShow } from './posts-controller.tsx'
import { initCommentsController, commentsIndex, commentsShow } from './comments-controller.tsx'
import { initUsersController, usersIndex, usersShow } from './users-controller.tsx'

type RenderOptions = {
  title: string; content: RemixNode; activeNav: string
  toast?: string; toastError?: string; breadcrumbs?: BreadcrumbItem[]
}

function renderAppLayout(opts: RenderOptions) {
  return render(<AppLayout activeNav={opts.activeNav} toast={opts.toast} toastError={opts.toastError} breadcrumbs={opts.breadcrumbs}>{opts.content}</AppLayout>)
}

// Initialize split controllers
initPostsController(renderAppLayout)
initCommentsController(renderAppLayout)
initUsersController(renderAppLayout)

// Each split module exports individual action handlers.
// The main controller imports them and wires them directly
// into the `actions` object by their route key name.
export default {
  actions: {
    async indexAction({ db }) {
      return renderAppLayout({ title: 'Dashboard', content: <DashboardPage />, activeNav: 'dashboard', breadcrumbs: [{ label: 'Home' }] })
    },
    postsIndex,
    postsShow,
    commentsIndex,
    commentsShow,
    usersIndex,
    usersShow,
  },
} satisfies Controller<typeof routes>
```

## Flat File vs Directory Convention

Remix 3 enforces a strict convention for controller file structure, validated by `pnpm remix doctor`:

### Single-Action → Flat File

```typescript
// app/routes.ts: messagesContent: get('/messages/content')
// App router: import { messagesContent } from './actions/messages-content.tsx'
```

```
app/actions/messages-content.tsx    ← Flat file, single GET action
```

### Multi-Action → Directory with controller.tsx

```typescript
// app/routes.ts: messages: route('messages', { index: get('/'), action: post('/') })
// App router: import messagesController from './actions/messages/controller.tsx'
```

```
app/actions/messages/
├── controller.tsx      ← Main controller with actions
├── page.tsx            ← Route-owned page component
└── fragment-page.tsx   ← Route-owned fragment component
```

Route-owned modules live alongside the controller, not in `app/ui/`.

### Decision Guide

| Route type | Example | File structure |
|-----------|---------|---------------|
| Single-action GET | `/messages/content` | `app/actions/messages-content.tsx` |
| Single-action POST | `/messages/subscribe` | `app/actions/messages-subscribe.tsx` |
| Multi-action (index + action) | `/messages` (GET + POST) | `app/actions/messages/controller.tsx` |
| Grouped routes | `/settings/*` (profile, account) | `app/actions/settings/controller.tsx` |

### Validation

Run `pnpm remix doctor` to validate controller paths match route conventions.

## Key Points

- `initXxxController()` receives shared layout renderer; stored in module-level variable
- Split modules export individual action handlers (not wrapped in `actions: {}`)
- Main controller imports handlers by name and maps them into its `actions` block with `satisfies Controller`
- For separate RouteMaps, use individual `router.map()` calls instead of splitting — each RouteMap gets its own controller

## Reference

- `examples/crud-controller.md` — Single-file CRUD pattern
- `guides/render-utilities.md` — Render utilities with renderFragment
- `guides/admin-utils.md` — Shared utilities
- `../concepts/controller-architecture.md` — Controller types, RouteMap vs leaf
- `guides/router-mapping.md` — router.map() vs verb methods
- `guides/controller-creation.md` — Creating controllers
