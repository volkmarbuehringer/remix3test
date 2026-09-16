---
name: remix3-token-json-api-alongside-session
description: "Use when adding a Bearer-token JSON API alongside session-authenticated Remix 3 routes — reuse the backend logic instead of duplicating it."
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

### 1. Extract shared CRUD logic into a lib module

Move `db.findOne`, `db.create`, `db.updateMany`, `db.delete`, etc. from the controller into pure functions in a lib module (e.g. `app/lib/<entity>-api.ts`; create `app/lib/` if it doesn't exist yet). Keep HTTP concerns (body parsing, status codes, response format) in the controller.

### 2. Create a token-authenticated API controller

Create a separate controller that calls `authenticateWebhook()` inline (no middleware registry needed) and delegates to the lib:

```ts
// app/actions/api/<entity>/controller.tsx
import { createController } from 'remix/router'
import { authenticateWebhook } from '<path-to-auth-webhook>'
import { routes } from '../../../routes.ts'
import type { AppContext } from '../../../types/context.ts'
import { getWidgetById, createWidget } from '<path-to-lib>'

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

The repo's live example is `app/actions/api/lists/controller.tsx` — token auth via `app/middleware/api-token-auth.ts` (`apiTokenAuth`) + `app/middleware/api-require-auth.ts` (`requireApiAuth`), with the shared CRUD in `app/data/lists.ts`.

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

CSRF: the repo's `app/middleware/skip-csrf.ts` already exempts `/api/` paths in `isExternalPath()` — add the new route under `/api/` and it stays CSRF-free.

### 4. Refactor the existing controller to use the same lib

Replace inline `db` calls with lib imports. Validation and HTTP concerns stay in the controller — only DB operations move to the lib.

## When to Use

- You need to expose a JSON API authenticated by a shared Bearer token (webhook pattern)
- The existing session-authenticated routes must remain unchanged
- You want to avoid duplicating CRUD logic between controllers
- The API consumer is another service, not a browser
- There is an existing `authenticateWebhook()` utility in the project