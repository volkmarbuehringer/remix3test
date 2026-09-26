# Route Contract and Controllers

**Source:** Installed guide `node_modules/remix/guides/02-routing-and-controllers.md` — route-builder table (L77–88), `resources()`/`resource()` options (L132–151), action-context table (L175–189), request-header note (L269), controller mapping and ownership (L271–305). Cross-checked against `node_modules/remix/src/fetch-router/README.md` (resource options L608–619; controllers and middleware L704–710) and the installed source `node_modules/.pnpm/@remix-run+fetch-router@*/node_modules/@remix-run/fetch-router/src/lib/` (`route-helpers/resources.ts`, `route-helpers/method.ts`, `router.ts`).

**Extracted:** 2026-09-26

**Context:** Adding or registering a route or controller in this app: picking resource-helper options, wiring a nested route map, or reading the built-in action context (`context.has`, `context.router`, `context.headers`).

## Problem

The guide introduces the route map, route builders, and controller ownership, but this app relies on parts the guide only mentions in passing (resource `exclude`, any-method leaves, nested-map registration), and the failure modes are easy to misread. A missing action does not fail on the first request; a controller cannot reach nested maps; `context.headers` is not a response-header channel. Copying the guide examples verbatim (`only`, `param`) produces a route contract that does not match the app.

## Solution

### Resource helpers: the app uses `exclude`, the guide shows `only`

- Guide L132–149 documents `only` and `param`. `resources()`/`resource()` also accept `exclude` (the complement of `only`) and `names`; `only` and `exclude` are mutually exclusive, enforced at the type level (`only?: never`) and at runtime (`Cannot specify both "only" and "exclude" options`). See `node_modules/remix/src/fetch-router/README.md` L608–619 and the installed `route-helpers/resources.ts` / `route-helpers/resource.ts`.
- This app uses `exclude` throughout: `app/routes.ts:76` (`appointment.types` = `exclude: ['new', 'show', 'edit']` → index/create/update/destroy), `app/routes.ts:238` (`verwaltung.resources` = `exclude: ['new', 'edit']` → index/show/create/update/destroy), and `app/routes.ts:240` (`verwaltung.offeringConfigs`). If you add a resource, keep the `exclude` spelling so the generated leaves stay consistent with the sibling routes; do not convert to `only` just because the guide uses it.
- Generated leaf names are conventional (`index`, `new`, `show`, `create`, `edit`, `update`, `destroy`) unless `names` renames them, and the path variable defaults to `id` unless `param` changes it. This app passes neither for these maps.
- `appointment.types` is its own nested route map, so it has its own doctor entry point (`app/actions/appointment/types/controller.tsx`, a re-export of `appointmentTypes` in `app/actions/appointment/controller.tsx:452`) and its own `router.map(routes.appointment.types, appointmentTypes)`.

### `patch`, `head`, `options`, and bare-string (any-method) leaves

- Guide L81 lists the method builders; `patch`, `head`, and `options` are exported from `remix/routes` exactly like `get`/`post` (`route-helpers/method.ts`). This app imports only `del, get, post, put, route, form, resources` at `app/routes.ts:1`; no `patch`/`head`/`options` leaf exists yet, so adding one is a new import from `remix/routes`.
- `head` interacts with `GET`: a `GET` route also serves `HEAD` (the router strips the body), and an explicit `HEAD` route wins for `HEAD` (`node_modules/remix/src/fetch-router/README.md` L259–277). This app registers no `HEAD` leaves and relies on the `GET` fallback.
- A bare-string leaf (`webhook: "/webhooks/github"`, guide L87) produces a `Route<'ANY', ...>` that matches any method, so its action must branch on `context.method`. This app has no `ANY` leaf today: the webhook/callback endpoints are `post(...)` (`app/routes.ts` `system.*`, mapped with `router.post(...)` in `app/router.ts`). If you add an `ANY` leaf, `context.method` is the field to switch on — the same field `app/middleware/uploads.ts:127` reads (`context.method === 'POST'`).

### A controller owns only its direct leaves; nested maps are registered separately

- Guide L271–305. `router.map(routeMap, controller)` walks only the direct `Route` leaves of `routeMap`; a nested map key is never auto-registered and needs its own `router.map(nestedMap, nestedController)` call.
- This app follows that rule: the root map controller owns only `assets`/`home` (`app/actions/controller.tsx` re-exports `app/actions/home/controller.tsx`), while each branch (`routes.lists`, `routes.appointment`, `routes.appointment.types`, each `routes.verwaltung.*`) is mapped separately in `app/router.ts:59-135`. The clearest example is `app/router.ts:109-110`: `routes.appointment` and `routes.appointment.types` are two controllers (`appointment`, `appointmentTypes`) for two maps.
- `router.map(...)` validates at registration, not on the first request. A missing direct leaf throws `TypeError: Missing action <key> in controller`; a nested map key placed inside `actions` throws `Cannot map nested route map key <key> in controller actions; call router.map() for that route map separately`; an unknown key throws `Unknown action <key> in controller` (installed `fetch-router/src/lib/router.ts` L499–530). In this app the calls run inside `createNewappRouter()` (`app/router.ts`), which `server.ts` invokes at module eval and tests use via `app/test-router.ts`, so the failure surfaces at import/startup — the setup-time throw guide L305 describes.

### Controller middleware does not flow into nested route maps

- Guide L303. `controller.middleware` is merged into each direct leaf registered from that controller (installed `fetch-router/src/lib/router.ts` L519–528); it is not inherited by a nested map mapped separately. If a nested branch needs the same boundary, put the middleware on that branch controller or share the middleware array.
- App seam: `routes.lists` and `routes.appointment` each declare `middleware: [requireAuth()]` on their own controller (`app/actions/lists/controller.tsx:77`, `app/actions/appointment/controller.tsx:122`), and the nested `appointment.types` controller repeats `requireAuth()` (`app/actions/appointment/controller.tsx:453`). The `requireAuth` on `routes.appointment` does not cover `routes.appointment.types`; the repetition is required, not redundant. The same pattern holds for the admin boundary on `routes.verwaltung.resources` (`app/actions/verwaltung/resources/controller.tsx:176`).

### Built-in action context: `has`, `router`, and the request-only `headers`

- `context.has(key)` returns whether a value was stored for a context key; it checks the context map only, so a key with a `defaultValue` reads `false` from `has` while `get` returns the default. Use it to detect whether an earlier middleware actually ran. There is no current app caller (grep `context.has(` under `app/` is empty); the context-key work is in `references/context-keys-and-dependency-flow.md`.
- `context.router` (guide L184) is the router handling the request; the getter throws `No router found in request context.` when unset. It is the seam for re-entering the pipeline from middleware: `app/middleware/frame-redirect.ts:66` calls `context.router.fetch(new Request(destination, { ..., signal: context.request.signal }))` to follow an in-frame redirect. That internal fetch bypasses `createRequestListener` (no client address, no `onError`), so anything the server boundary injects (such as `X-Client-Ip`) must be forwarded explicitly — as that call does for the `Cookie` header.
- `context.headers` is a mutable copy of the request headers (guide L183); guide L269 states that it is not the response headers and that controllers have no response-header API — return a `Response` and set its headers. App seam: `app/middleware/frame-redirect.ts` reads request headers from `context.request.headers`, builds request headers into a `Request`, and writes response headers with `frameResponse.headers.set(...)` on the returned `Response`. Do not look for a `context.response` or a context header setter.

## When to Use

- Adding or reshaping a CRUD route with `resources()`/`resource()` and deciding `only` vs `exclude` in this app.
- Registering a controller for a route map whose branches are handled by their own controllers, or triaging a `Missing action` / `nested route map key` / `Unknown action` throw at startup.
- Adding a `patch`/`head`/`options` leaf or an any-method (bare-string) route whose handler must check `context.method`.
- Reading `context.has`, `context.router`, or `context.headers` inside middleware/actions and expecting response-side behavior from `context.headers`.

## Reference

- `app/routes.ts` — route contract; `app/router.ts` — `router.map(...)` wiring; `app/actions/` — controllers and doctor entry points.
- Installed source of truth for ownership and validation: `node_modules/.pnpm/@remix-run+fetch-router@*/node_modules/@remix-run/fetch-router/src/lib/router.ts` (`mapController`) and `.../route-helpers/resources.ts`.
