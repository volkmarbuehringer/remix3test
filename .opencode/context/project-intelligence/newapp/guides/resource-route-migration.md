<!-- Context: project-intelligence/newapp/guides/resource-route-migration | Priority: high | Version: 1.0 | Updated: 2026-05-29 -->

# Converting Manual CRUD Routes to `resources()`

**Purpose**: Step-by-step guide for identifying and replacing manual CRUD route blocks with the `resources()` helper in `app/routes.ts`.

## Step 1: Identify Pure CRUD Route Blocks

A route block qualifies if it has **only** standard CRUD actions (index, create, update, destroy) — no custom actions, non-standard patterns, or SSE endpoints:

```ts
// ✅ Qualifies — only index/create/update/destroy
route('resources', {
  index: get('/'),
  create: post('/'),
  update: put('/:id'),
  destroy: del('/:id'),
})

// ❌ Not qualified — custom actions exist
route('nutzer', {
  index: get('/'),
  create: post('/'),
  update: put('/:id'),
  destroy: del('/:id'),
  resetPassword: post('/:id/reset-password'),  // custom
  toggleLock: post('/:id/toggle-lock'),        // custom
})
```

## Step 2: Add `resources` to Import

```ts
import { del, get, post, put, route, form, resources } from 'remix/routes'
```

## Step 3: Replace with `resources()` Call

```diff
- route('users', {
-   index: get('/'),
-   create: post('/'),
-   update: put('/:id'),
-   destroy: del('/:id'),
- })
+ resources('users', { exclude: ['new', 'show', 'edit'] })
```

Use `exclude` when controllers/UI are missing for show/new/edit. When all 7 routes have handlers, omit `exclude` entirely.

## Step 4: Verify

```sh
npm run typecheck   # No type errors if controller action keys match
npm test            # All route-related tests pass
```

The route keys (index, create, update, destroy) are unchanged, so controllers and `.href()` references require no modifications.

## Decision Table

| Scenario | Option |
|----------|--------|
| Pure CRUD, no show/new/edit handlers | `resources('name', { exclude: ['new', 'show', 'edit'] })` |
| Full CRUD with all 7 handlers | `resources('name')` |
| Only specific CRUD actions | `resources('name', { only: ['index', 'create', 'destroy'] })` |
| Custom param name | `resources('name', { param: 'myId' })` |

## 📂 Codebase References

**Implementation**:
- `newapp/app/routes.ts` — Where converted routes live
- `newapp/app/router.ts` — Controller mappings (unchanged after conversion)

**Reference**:
- `packages/fetch-router/src/lib/route-helpers/resources.ts` — Helper implementation
- `development/remix3/fetch-router/guides/resource-routes.md` — Full API docs
