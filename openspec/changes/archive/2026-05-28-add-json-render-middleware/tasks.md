## 1. Middleware & Router Setup

- [x] 1.1 Create `app/middleware/json-render.ts` — a `renderWith()` wrapper that provides `context.json(data, init?) => Response`
- [x] 1.2 Install the `json()` middleware in `app/router.ts` (after the UI `render()` middleware)
- [x] 1.3 Add `ReturnType<typeof json>` to the `RootMiddleware` tuple in `app/types/context.ts`
- [x] 1.4 Run `tsc --noEmit` to verify type inference across the project

## 2. Lists Controller Migration

- [x] 2.1 Migrate `listsSave` action in `app/actions/lists-controller.tsx` — replace 5 manual `new Response(JSON.stringify(...))` calls with `context.json(...)`
- [x] 2.2 Migrate `listsData` action in `app/actions/lists-controller.tsx` — replace 4 manual `new Response(JSON.stringify(...))` calls with `context.json(...)`

## 3. Client Controller Migration

- [x] 3.1 Migrate `app/actions/client/controller.tsx` — replace 4 `Response.json(...)` calls with `context.json(...)`

## 4. Chat & Agent Controller Migration

- [x] 4.1 Migrate `app/actions/chat-controller.tsx` — replace 4 JSON response calls with `context.json(...)`
- [x] 4.2 Migrate `app/actions/agent-controller.tsx` — replace 3 JSON response calls with `context.json(...)`

## 5. Workflow Controller Migration

- [x] 5.1 Migrate `app/actions/workflow-controller.tsx` — replace 2 `new Response(...)` with manual JSON construction to `context.json(...)`

## 6. Admin Controllers Migration

- [x] 6.1 Migrate `app/actions/admin-nutzer-controller.tsx` — replace 22 `Response.json(...)` calls with `context.json(...)`
- [x] 6.2 Migrate `app/actions/admin-offerings-controller.tsx` — replace 12 `Response.json(...)` calls with `context.json(...)`
- [x] 6.3 Migrate `app/actions/admin-appointments-controller.tsx` — no JSON responses found

## 7. Verification

- [x] 7.1 Run `tsc --noEmit` — confirm zero type errors
- [x] 7.2 Confirm zero remaining `Response.json(...)` or `new Response(JSON.stringify(...))` in controllers (only test files and non-response `JSON.stringify` calls remain)
- [x] 7.3 Run `pnpm run test` — 511 tests pass, zero failures
