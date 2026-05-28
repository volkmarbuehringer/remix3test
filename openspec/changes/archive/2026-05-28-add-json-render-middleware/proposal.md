## Why

Over 30 JSON API response calls across the app manually construct `new Response(JSON.stringify(...), { headers: { 'Content-Type': 'application/json' } })`. This boilerplate is repetitive, error-prone (headers can be forgotten), and obscures the intent of each handler. The existing `renderWith()` pattern — already used for HTML UI rendering — solves exactly this class of problem by attaching a typed renderer function to request context.

## What Changes

- **New middleware** `app/middleware/json-render.ts` — a `renderWith()` wrapper that provides `context.json(data, init?)` as a typed JSON response helper
- **Router integration** — install the `json()` middleware in the router stack
- **Type augmentation** — add `ReturnType<typeof json>` to the `AppContext` middleware tuple
- **Controller migration** — replace all manual `new Response(JSON.stringify(...))` and `Response.json(...)` calls with `context.json(...)` across 7+ controllers

## Capabilities

### New Capabilities

- `json-render-middleware`: adds a request-scoped JSON renderer to router context, and migrates existing controllers to use it

### Modified Capabilities

*(none — no existing specs are changing)*

## Impact

- **Files created**: `app/middleware/json-render.ts`
- **Files modified**: `app/router.ts`, `app/types/context.ts`, `app/actions/lists-controller.tsx`, `app/actions/client/controller.tsx`, `app/actions/chat-controller.tsx`, `app/actions/agent-controller.tsx`, `app/actions/workflow-controller.tsx`, `app/actions/admin-nutzer-controller.tsx`, `app/actions/admin-offerings-controller.tsx`, `app/actions/admin-appointments-controller.tsx`
- **Dependencies**: none — uses only `remix/middleware/render` (already a dependency)
- **Zero runtime dependencies added**
