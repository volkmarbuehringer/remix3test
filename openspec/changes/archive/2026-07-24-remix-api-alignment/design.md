## Context

The app was initialized against an earlier Remix 3 beta. Since then:

- `RouterTypes` augmentation (already in `app/router.ts`) makes `DefaultContext` resolve to the app's context type, yet every controller explicitly passes `<typeof routes.X, AppContext>` — the `AppContext` second generic is dead weight.
- A `mount()` API was added to `fetch-router` for registering route groups under a path prefix. The app currently uses flat `router.map()` for all route trees.
- Several custom middleware already register properties via `{ property: 'name' }` (`db`, `mailer`, `logger`, `jsonBody`, `apiUser`), but existing controller code inconsistently accesses them via `context.get(Key)` instead of `context.property`.

All three changes are mechanical — no behavior changes, no new dependencies, no migration steps.

## Goals / Non-Goals

**Goals:**
- Remove redundant `AppContext` generic from all `createController`/`createAction` calls
- Group admin and verwaltung route registration under `router.mount()` blocks
- Switch remaining `context.get(Logger|JsonBody|ApiUser)` to `context.logger`/`context.jsonBody`/`context.apiUser`

**Non-Goals:**
- No runtime behavior changes
- No new middleware or context keys
- No restructuring of the route trees themselves (just registration style)
- No changes to specs, tests, or test utilities

## Decisions

**1. Drop AppContext generic entirely vs just the second param**

Remove the second generic *and* the import of `AppContext` from every controller. The first generic (`typeof routes.X`) is inferred from the argument and can also be omitted. Either way the result is identical. Choice: drop both generics and the import for maximum cleanup.

**2. Which groups get `mount()`**

Only admin (7 sub-routes) and verwaltung (9 sub-routes) — the two clear multi-route groups in `router.ts`. Auth routes, API routes, and agent routes are fewer and flatter; `mount()` would add nesting without benefit.

**3. Which `context.get(Key)` calls to convert**

Three keys have `{ property: 'name' }` already registered but still accessed via `get()`:

| Key | Property | Occurrences |
|---|---|---|
| `Logger` | `logger` | 12 |
| `JsonBody` | `jsonBody` | 9 |
| `ApiUser` | `apiUser` | 6 |

These are the only three. Other properties (`db`, `mailer`, `json`, `auth`, `formData`, `session`, `render`) are already accessed directly.

## Risks / Trade-offs

- **Zero risk on generic removal** — two existing call sites already omit the second generic and compile fine. This is purely mechanical.
- **mount() is cosmetic for this codebase** — mount prefix params aren't used by any sub-routes today (the prefixes don't capture named segments). The value is organizational. No risk.
- **Property rename risk** — a search-and-replace from `context.get(Logger)` to `context.logger` is semantically equivalent. TypeScript will catch any mismatches.
