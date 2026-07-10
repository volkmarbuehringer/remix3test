---
name: remix3-token-json-api-alongside-session
description: 'Add Bearer-token JSON API endpoints alongside session-authenticated routes in Remix 3, reusing backend logic.'
user-invocable: false
origin: auto-extracted
---

# Remix 3: Token-Authenticated JSON API Alongside Session Routes

**Extracted:** 2026-06-29
**Context:** When you need to expose existing CRUD functionality (or a subset of it) via a Bearer-token JSON API, while keeping the existing session-authenticated HTML/JSON routes intact.

## Problem

In a Remix 3 app with session-authenticated routes (cookie + CSRF), you need to serve the same data via a JSON API authenticated by a shared webhook token (`Authorization: Bearer <token>`). You cannot reuse the existing endpoints because:

- Session routes require CSRF tokens and login cookies
- You want the API consumer to use a simple Bearer token
- You want to avoid duplicating CRUD logic

## Solution

Use a three-part pattern:

### 1. Extract shared CRUD logic into `app/lib/`

Move `db.findOne`, `db.create`, `db.updateMany`, `db.delete`, etc. from the controller into pure functions in a lib module. Keep HTTP concerns (body parsing, status codes, response format) in the controller.

```ts
// app/lib/widgets-api.ts
import { widgets } from '../data/schema.ts'
import type { Pool } from 'pg'

export async function getWidgetById(db: { findOne: Function }, id: number) {
  let row = await db.findOne(widgets, { where: { id } })
  if (!row) return null
  return { id: row.id, name: row.name /* ... */ }
}

export async function createWidget(db: { create: Function }, input: { name: string }) {
  let row = await db.create(
    widgets,
    { name: input.name, created_at: Date.now() },
    { returnRow: true },
  )
  return { id: row.id, name: row.name }
}
```

### 2. Create a token-authenticated API controller

Create a separate controller that calls `authenticateWebhook()` inline (no middleware registry needed) and delegates to the lib:

```ts
// app/actions/api/widgets/controller.tsx
import { createController } from 'remix/router'
import { authenticateWebhook } from '../../../lib/auth-webhook.ts'
import { routes } from '../../../routes.ts'
import type { AppContext } from '../../../types/context.ts'
import { getWidgetById, createWidget } from '../../../lib/widgets-api.ts'

export default createController<typeof routes.apiWidgets, AppContext>(routes.apiWidgets, {
  middleware: [], // no session auth

  actions: {
    async index(context) {
      let auth = authenticateWebhook(context.request)
      if (auth instanceof Response) return auth
      // ... use lib functions
    },
    async create(context) {
      let auth = authenticateWebhook(context.request)
      if (auth instanceof Response) return auth
      // ... parse body, validate, call lib, return JSON
    },
    // show, update, destroy follow the same pattern
  },
})
```

### 3. Wire the new routes + CSRF exemption

```ts
// app/routes.ts
export const routes = route({
  // ... existing routes
  apiWidgets: route('api/widgets', {
    index: get('/'),
    show: get('/:id'),
    create: post('/'),
    update: put('/:id'),
    destroy: del('/:id'),
  }),
})
```

```ts
// app/router.ts
router.map(routes.apiWidgets, apiWidgetsController)
```

```ts
// app/middleware/skip-csrf.ts — add /api/ prefix exemption
export function skipCsrf(): Middleware {
  return async (context, next) => {
    if (
      context.url.pathname.startsWith('/api/') || // NEW
      context.url.pathname === '/webhook' ||
      context.url.pathname === '/app-webhook' ||
      context.url.pathname === '/callback'
    ) {
      return next()
    }
    return csrfMiddleware(context, next)
  }
}
```

### 4. Refactor the existing controller to use the same lib

Replace inline `db` calls with lib imports. Validation and HTTP concerns stay in the controller — only DB operations move to the lib.

```ts
// Before
let row = await db.findOne(widgets, { where: { id: listId } })

// After
import { getWidgetById } from '../../lib/widgets-api.ts'
let row = await getWidgetById(db, listId)
```

## When to Use

- You need to expose a JSON API authenticated by a shared Bearer token (webhook pattern)
- The existing session-authenticated routes must remain unchanged
- You want to avoid duplicating CRUD logic between controllers
- The API consumer is another service, not a browser
- There is an existing `authenticateWebhook()` utility in the project (from `app/lib/auth-webhook.ts`)
