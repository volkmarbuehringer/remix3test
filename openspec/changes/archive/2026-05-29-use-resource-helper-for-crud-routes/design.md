## Context

The newapp codebase has three CRUD route blocks defined manually in `app/routes.ts` that are pure CRUD with no custom actions beyond index, create, update, destroy:

```ts
// Admin section (nested under route('admin', ...)):
resources: route('resources', {
  index: get('/'),
  create: post('/'),
  update: put('/:id'),
  destroy: del('/:id'),
}),

users: route('users', {
  index: get('/'),
  create: post('/'),
  update: put('/:id'),
  destroy: del('/:id'),
}),

// Appointment section (nested under route('appointment', ...)):
types: route('types', {
  index: get('/'),
  create: post('/'),
  update: put('/:id'),
  destroy: del('/:id'),
}),
```

The `remix/routes` module exports `resources()` which auto-generates all 7 standard CRUD routes (index, new, show, create, edit, update, destroy) with full type safety. Adopting it for these pure CRUD blocks reduces boilerplate, improves consistency, and gives `show`/`new`/`edit` routes for free.

## Goals / Non-Goals

**Goals:**
- Replace three manual route blocks with `resources()` calls: `admin/resources`, `admin/users`, `appointment/types`
- Maintain identical behavior for all existing routes (index, create, update, destroy)
- Gain `show`, `new`, `edit` routes as additive, non-breaking additions
- Keep controller and UI changes minimal — existing functionality untouched

**Non-Goals:**
- Not converting routes with custom actions (nutzer, offerings, appointments, client, chatlog, messages, lists — those stay manual)
- Not adopting `resource()` (singular) — no singleton resources exist yet
- Not changing router.ts, controllers, or middleware
- Not changing any database or schema

## Decisions

### Decision 1: Use `resources()` with default options

`resources()` generates routes with `:id` as the parameter name, which matches the existing pattern in all three blocks. No `param` override needed.

```ts
resources: resources('resources'),   // was manual route block under admin
users: resources('users'),           // was manual route block under admin
types: resources('types'),           // was manual route block under appointment
```

### Decision 2: Import `resources` alongside existing route helpers

The import already has `del, get, post, put, route, form` — just add `resources`:

```ts
import { del, get, post, put, route, form, resources } from 'remix/routes'
```

### Decision 3: Exclude `new`, `show`, `edit` routes for now

The `resources()` helper generates 7 standard CRUD routes by default. However, the `createController` type system in Remix 3 requires a handler for every route key. Since there are no controllers or UI for `new`, `show`, `edit` yet, these are excluded with the `exclude` option:

```ts
resources('users', { exclude: ['new', 'show', 'edit'] })
```

This keeps the generated route set identical to what existed before — only `index`, `create`, `update`, `destroy`:

| Route Key | Method | Pattern | Status |
|-----------|--------|---------|--------|
| index     | GET    | `/`     | ✅ unchanged |
| create    | POST   | `/`     | ✅ unchanged |
| update    | PUT    | `/:id`  | ✅ unchanged |
| destroy   | DELETE | `/:id`  | ✅ unchanged |

When real controllers and UI for `show`/`new`/`edit` are built, the `exclude` can simply be removed.

### Decision 4: Route map spreads — use `resources()` directly inside `route()`

`resources()` returns a `RouteMap` object (with `Route` instances). The `route()` builder treats nested objects as sub-routes and joins their patterns with the parent base pattern. So:

- Inside `route('admin', { ... })` → `/admin/resources/...`, `/admin/users/...`
- Inside `route('appointment', { ... })` → `/appointment/types/...`

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| New routes (`show`, `new`, `edit`) are exposed but have no handler | They'll return Remix's default 404, which is safe. Adding handlers later is straightforward. |
| The `resources()` helper generates `edit` and `new` GET routes which could conflict with future route definitions | Unlikely — these are standard CRUD conventions. If needed, `exclude: [...]` can filter them out. |
| Developers unfamiliar with `resources()` may not realize it generates 7 routes | Minimal — the helper is from the framework itself and the pattern is standard Rails-style RESTful routing. Documentation in the route file is sufficient. |
