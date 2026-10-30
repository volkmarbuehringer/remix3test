---
name: remix3-server
description: "Use when building or hardening Remix 3 server-side routes and controllers — createController vs createAction, the route contract (resources/exclude, patch/head/options, nested-map registration, context.method), context keys and Pick slices, the request pipeline (createRequestListener, middleware ordering, RouterContext vs MiddlewareContext, request.signal), controller consolidation + error-centralization tests, opaque RoutePattern access, typed remix/headers, adding/moving/deleting routes + typed routes.* URLs + parseSafe/context.render upgrades, multipart/fs/S3/bytea uploads, the bytea upload-handler delta, ZIP via node:zlib, shared query parser for PDF/CSV export, and request-handling security (CSRF/CORS/cross-origin middleware, client-IP trust, open redirects, IDOR ownership-scope, path traversal, CSP nonces, Bearer-token JSON API)."
user-invocable: false
origin: consolidated
---

# Remix 3 Server: Controllers, Routes, Uploads & Security

Consolidated from 4 former learned skills (`remix-controllers`, `remix3-route-wiring`, `remix-file-uploads`, `security-gotchas`) on 2026-10-17. Reference files are namespaced under `references/<former-skill>/`. Everything vendor-supplied (guides, package READMEs, the vendor `remix` / `mastra` skills) stays authoritative — sections below are deltas only.

## Load Only The Sections You Need

| You need... | Section | References |
| --- | --- | --- |
| Typing/consolidating controllers & middleware — createController/createAction, route contract, context keys, request pipeline, headers, RoutePattern, id-shaped param validation | § Controllers & Middleware | `references/remix-controllers/` |
| Adding/moving/deleting routes — admin sidebar (SSE auth 401, iframeNav), relocating between trees, routes.* URL tree, parseSafe upgrades | § Route Wiring | `references/remix3-route-wiring/` |
| Upload/download endpoints — multipart, fs/S3/bytea, ZIP via node:zlib, PDF/CSV export with shared query parser, download guards | § File Uploads & Downloads | `references/remix-file-uploads/` |
| Hardening request security — CSRF/CORS, client-IP trust, open redirects, IDOR, path traversal, CSP nonces, Bearer-token API | § Request-Handling Security | `references/security-gotchas/` |

## Controllers & Middleware

_(formerly `remix-controllers` — references live under `references/remix-controllers/`)_

**Consolidated from:** `remix-createContextKey-property-middleware`, `remix-createController-generic-helper-edge-case`, `remix-createController-requires-route-map`, `remix-consolidate-controllers`, `remix-middleware-error-centralization`, `remix-routepattern-opaque-access`, `remix-headers`

This skill is the **index** for controller/middleware deltas. For the framework API and canonical patterns, use the vendor references `node_modules/remix/guides/02-routing-and-controllers.md` and `node_modules/remix/src/fetch-router/README.md`.

### Load Only The References You Need

| Task involves... | Start with |
| --- | --- |
| `createController` vs `createAction`, `form()` routes, TS errors about `RouteMap`/`ActionRoute`, explicit generics, `Pick<AppContext, ...>` helper params | `references/remix-controllers/controller-routing-and-types.md` |
| A typed `context.<property>` from middleware, `Symbol` key errors, circular `AppContext` dependency flow | `references/remix-controllers/context-keys-and-dependency-flow.md` |
| Merging flat controller directories into a parent `controller.tsx` (names, imports, router, tests, `remix doctor`) | `references/remix-controllers/controller-consolidation.md` |
| Existing tests breaking after moving error handling into middleware | `references/remix-controllers/error-centralization-tests.md` |
| Route contract: `resources()`/`resource()` options (`only` vs this app's `exclude`), `patch`/`head`/`options` or any-method/bare-string leaves, nested-map registration and startup throws, `context.has`/`context.router`/request-only `context.headers` | `references/remix-controllers/route-contract-and-controllers.md` |
| Request pipeline: `createRequestListener` options and the `(request, client)` arg, root middleware order (`compression`/`staticFiles`/`logger`), `RouterContext` vs `MiddlewareContext`, `request.body`/`request.signal` streaming and cancellation | `references/remix-controllers/request-middleware.md` |
| `RoutePattern` is opaque and `.pathname.tokens`/`_parts` access breaks; you need the pattern's variables/wildcards | `references/remix-controllers/routepattern-opaque-access.md` |
| Constructing or parsing HTTP headers with the typed `remix/headers` classes (Content-Disposition quoting, `Content-Length`, browser-safe `ContentType`) | `references/remix-controllers/headers.md` |

### Core Rules

- Single-method routes (`get`/`post`/`put`/`del`) use `createAction` + `router.get/post/...`; `form()` routes use `createController` with `actions.index`/`actions.action` + `router.map()`.
- Context keys must be `object`s — use `createContextKey`, never `Symbol`.
- Keep the `createController<typeof routes.x, AppContext>` generic when a typed helper needs a specific middleware-provided type; prefer fixing the wrapper (`requireAuthenticatedUser<User>`) at the source when possible.
- Type controller-helper params as `Pick<AppContext, ...>` of the members used, not the whole `AppContext` (whole-object assignment fails via `get()` method variance).
- Keep `app/middleware/root.ts` free of `router.ts`/controller imports so `AppContext` derives without a cycle.
- **Id-shaped inputs use `parseId` + a bound check — not `Number.isFinite`**: route params, query strings, and form fields are all untrusted. `Number.isFinite(Number(param))` accepts any finite number, so `?editing=1.5`/`?editing=1e30` reached the `int4` comparison and 500ed with Postgres `invalid input syntax for type integer: "1.5"`; `parseId` (`app/utils/ids.ts`) returns `undefined` unless the value is a safe integer — guard with `id !== undefined && id > 0`. Regression-test the fractional case (`app/actions/admin/admin-lists.test.ts`: `?editing=1.5` → 200, no edit panel; it fails at the DB layer without the fix).

**Route Contract and Resource Helpers (`references/remix-controllers/route-contract-and-controllers.md`)**

- `resources()`/`resource()` accept `exclude` as well as `only` (mutually exclusive); this app uses `exclude` (`app/routes.ts:83,252,254`) — do not rewrite to `only`.
- A controller owns only the direct `Route` leaves of its map; register nested maps (e.g. `routes.appointment.types`) separately. A missing, unknown, or nested key throws a `TypeError` at `router.map(...)` (startup), not on the first request.
- `controller.middleware` reaches only that controller's direct leaves, not a separately-mapped nested map; repeat the boundary there.
- Bare-string leaves are `Route<'ANY', ...>` — branch on `context.method`. `context.headers` is request headers, so return a `Response` for response headers; `context.router` re-enters the pipeline.

**Request Pipeline and Middleware Ordering (`references/remix-controllers/request-middleware.md`)**

- The app owns the 500 response via `renderServerError()` in `app/utils/server-handler.ts`, wired through `createRequestListener`'s `onError` in `server.ts` (app re-checked 2026-10-14: `onError` is now passed and `createServerHandler` no longer wraps `router.fetch` in try/catch); the client address arrives via the listener's `(request, client)` argument and is stamped as `X-Client-Ip`.
- Root order lives in `app/middleware/root.ts`: `securityHeaders()` → `compression()` → `staticFiles('./public', { index: false })`, then `session()`/`asyncContext()`/`loadDatabase()`/`loadAuth()` before the upload parser; `loadDatabase()` must precede `loadAuth()`, and `skipCsrf()` must stay after the parser because `csrf()` reads the parsed form.
- `logger()` / `context.logger?.(...)` is the app logging channel. Derive `AppContext` with `MiddlewareContext<ReturnType<typeof createNewappMiddleware>>` and keep the `declare module 'remix'` augmentation; do not switch to `RouterContext<typeof router>` without inlining the chain.
- `request.body` is a Web stream (`app/middleware/json-body.ts` caps and cancels it); use `context.request.signal` for disconnect cleanup.

**Opaque `RoutePattern` (`references/remix-controllers/routepattern-opaque-access.md`)**

- `RoutePattern` is opaque on current builds: use `.source`/`toString()`, `.toJSON()`, or `getRoutePatternCaptures(pattern)`; never `.pathname.tokens`/`_parts`. The common parent-path rewrite is string-based: `route.pattern.source.replace(/\/[:*][^/]*$/, '/')` (the app's `routeParentPath()` in `app/route-labels.ts`).

**Typed headers (`references/remix-controllers/headers.md`)**

- With the typed `remix/headers` classes, pass clean values and let the class quote (do not pre-escape `Content-Disposition` filenames); `Content-Length` accepts a `number`; and `ContentType` from `remix/headers/content-type` is browser-safe — prefer `ContentType.from(value).mediaType` over a hand-rolled `split(';')`.

### When to Use

- You are adding or reshaping the route contract (resource helper options, a method-specific leaf, or a nested route map) and need the app-specific seams the guide cannot know.
- You are wiring or debugging controllers: nested-map registration, startup `Missing action`/`Unknown action` throws, or controller middleware that does not reach a nested branch.
- You are editing the server boundary or the root middleware chain: `createRequestListener` options, client address, middleware order, logging, or `AppContext` derivation.
- You are reading built-in action context (`context.has`, `context.router`, `context.headers`) or handling `request.body`/`request.signal`.
- A `RoutePattern` property access stops typechecking after a Remix update, or you need its captures.
- You are building or parsing HTTP headers and reaching for raw strings instead of the typed classes.
- A controller reads a numeric id from a query string or form field and a crafted non-integer value 500s the page (`invalid input syntax for type integer`).

### Related Skills

- `remix3-server § Route Wiring` (`references/remix3-route-wiring/route-relocation.md`) — moving routes between route trees (frame ↔ top-level)
- `node_modules/remix/src/render-middleware/README.md` — wiring request-scoped renderers into the router

---

## Route Wiring

_(formerly `remix3-route-wiring` — references live under `references/remix3-route-wiring/`)_

**Consolidated from:** `remix3-standalone-route-admin-sidebar`, `remix-route-relocation`, `remix3-typesafe-url-audit`

This skill is the **index** for wiring and moving routes in a Remix 3 app: registering a standalone route and exposing it in the admin sidebar, relocating a route between route trees, upgrading form validation to `parseSafe` + `context.render`, and deleting a route. For the route trees, controllers, frames, and rendering APIs themselves, use the vendor `remix` skill (`.opencode/skills/remix/SKILL.md`) and the package READMEs it points at.

### Load Only The References You Need

| Symptom / task involves... | Start with |
| --- | --- |
| Adding a standalone route (webhook/API/SSE) and linking it from the admin sidebar; `renderAdminPage()` crashes or renders blank; `iframeNav: false`; an SSE endpoint returns 401 instead of a redirect; `requireAdminSseAuth()` auth-state behavior | `references/remix3-route-wiring/standalone-route-admin-sidebar.md` |
| Moving a route between trees (admin frame-sidebar ↔ top-level, frame ↔ full-page); keeping the old URL alive; frame removal; upgrading form validation to `parseSafe` + `context.render`; deleting a route | `references/remix3-route-wiring/route-relocation.md` |
| Converting hardcoded `href`/`action`/`src` strings to the typed `routes.*` tree, or auditing after a route rename | `references/remix3-route-wiring/typesafe-url-audit.md` |

### Core Rules

**Standalone route + admin sidebar (`references/remix3-route-wiring/standalone-route-admin-sidebar.md`)**

- A route registered directly with `router.get()`/`router.post()` (or a named route-tree export composed via `router.map()`) is **not** under the admin tree and cannot use `renderAdminPage()` — the admin layout Frame navigation (`X-Remix-Target`) makes that crash or render blank. Register it outside the tree (vendor `remix` skill / guide chapter 02 on mapping controllers) and render it with its own `context.render(<Document title='…'><Layout><Page /></Layout></Document>)`. Link it from `app/ui/admin-layout.tsx` with `iframeNav: false`, which forces a full-page navigation (`document: true` instead of `target: frameTarget`). The CLI route-tree discovery note now lives in `remix3-tooling § Build & Tooling` (`references/remix3-build-and-tooling/cli-devops.md`).
- SSE and other non-interactive endpoints (EventSource, WebSocket) cannot follow `requireAuth()` HTTP 302s, so use the repo SSE-auth middleware in `app/middleware/sse-auth.ts` — `requireAdminSseAuth()` returns a plain **401** when `loadAuth()` is not installed or there is no valid session (`!auth.ok` or no `identity`), **403** for a non-admin identity, and passes through an admin session; never `requireAdmin`, whose redirect/HTML breaks `EventSource`. (app re-checked 2026-10-14: the auth-only `requireSseAuth()` export was removed — only `requireAdminSseAuth()` remains.) For client-IP extraction use the corrected two-tier trust model (`remix3-server § Security` → `references/security-gotchas/two-tier-ip-trust-model.md`); do NOT enable `trustProxy: true` without a stripping reverse proxy, which lets clients spoof forwarded headers.

**Route relocation, validation upgrade, deletion (`references/remix3-route-wiring/route-relocation.md`)**

- **Relocating between trees:** move and remove the `routes.ts` entry and verify path nesting (`route('foo')` at top level produces `/foo`); keep the old URL alive with a same-origin redirect in the source tree — `Location: '/admin' + context.url.pathname + context.url.search`, always prepending a fixed prefix and never using the raw `pathname` as the whole Location. Update `router.map(<newRouteRef>, <controller>)`, register static children (`create`, `events`) **before** the parent dynamic `:id` resolver, and add a test proving the static child hits its own handler (an SSE `events` route must return `text/event-stream`, not the `:id` redirect). Add the route to the target nav (main navbar `NAV_SECTIONS`, sidebar, or both), remove it from the old nav location and the old `AdminNavItem` union, and update `route-labels.ts`. Then audit `grep -r 'old/path' app/` across controller redirect `Location` headers, page `ADMIN_BASE`/form `action`/cancel links, form components, ClientEntry/asset fetch URLs and `window.location.href` navigations, and tests, and fix relative-import depth (`git mv` one directory deeper adds a `../` to every relative import, surfacing as `TS2307`; for `public/` client entries see `remix3-tooling § Build & Tooling` → `references/remix3-build-and-tooling/browser-source-public-colocation.md`). When leaving the frame layout, replace `renderAdminPage(context.render, 'key', ...)` with `context.render(<Layout title='Page Title'><PageComponent /></Layout>)` imported from `app/ui/layout.tsx`, and remove every `data-rmx-target={frames.*}` and the `frames` import (plain `<a href>` navigates full-page). Preserve each handler redirect status: `redirect(url)` defaults to **302**, so a frame-PRG handler that returned an explicit **303** must keep `new Response(null, { status: 303, ... })`, with a test assertion to catch the regression.
- **Validation upgrade, review, and deletion:** upgrading form validation to `parseSafe` + `context.render` follows the full pattern in `remix3-forms § Validation Errors`; afterward verify that `npm run typecheck` and `npm test` pass, no stale `old/path` and no `data-rmx-target` attributes remain, every text input has `inputErrorStyle` + `fieldErrorStyle`, required DB fields have `minLength(1)` in the schema, DB-error catch blocks re-render with a user-friendly message (no re-throw), and `route-labels.ts` is updated. Deleting a route entirely is a wider sweep than relocation — one missed reference breaks the **whole** test suite: remove the route tree **and its frame name** (`app/routes.ts` `frames`), the `router.map(...)` (`app/router.ts`), the re-export (`app/actions/admin/controller.tsx`), the `app/ui/admin-layout.tsx` nav item/icon case/`AdminNavItem` union member/`contentOnlyTargets`/`fullHeightTargets`, the frame from `ADMIN_FRAME_TARGETS` (`app/middleware/frame-redirect.ts`), the `ROUTE_LABELS` entry (`app/route-labels.ts`), the frame from `FRAME_TARGETS` (`app/ui/verwaltung-layout.tsx`), the frame from `getSelfFrameTarget` (`app/utils/frame-target.ts`), and the path from `AGENT_PATHS` (`app/middleware/skip-csrf.ts`). Two gotchas: grep by the **frame name** as well as the route path (`frames.<name>` lives in `frame-redirect.ts`, `verwaltung-layout.tsx`, and `frame-target.ts`; sweep with `grep -rn '<FrameName>\|routes.<tree>.<key>' app/`), and repair every reference before running any test because the test runner loads every controller transitively through the router — a to-be-deleted controller importing a moved file fails the ENTIRE `remix test` run with `Cannot find module ... imported from <deleted-controller>`.

**Typesafe URL audit (`references/remix3-route-wiring/typesafe-url-audit.md`)**

- Hardcoded `href="/…"`, `action="/…"`, `src="/…"`, `url="/…"`, `fetch("/…")`, `redirect("/…")`, and `new URL("/…")` strings bypass the typed tree — sweep with those regexes and convert to `routes.<tree>.<leaf>.href()` / `.href({ id })`; a `form()` route resolves via `.index.href()`. Leave test fixtures with fake routes, serialized-output assertion strings, and JSDoc examples alone.

### When to Use

- You are adding a new feature route that should appear in the admin sidebar but is not part of the admin route tree, or adding external-facing endpoints (webhooks, API routes, SSE) that need admin navigation.
- You are moving a route between route trees (admin frame-sidebar ↔ top-level, frame ↔ full-page) and need the route-definition, router-mapping, navigation, and URL-string checklist.
- You are removing a route entirely and must sweep every frame/nav/router/label reference before the test suite can load.
- You are upgrading form validation to `parseSafe` + `context.render` after (or during) a relocation, or verifying such a change with the post-relocation review checklist.
- An SSE endpoint returns 401 instead of redirecting, or `renderAdminPage()` crashes or blanks a standalone route.
- The vendor/docs do not cover these app-specific wiring deltas — they are version-pinned to this repo.
- You are converting hardcoded URLs in nav links, forms, or pages to the typed `routes.*` tree, or sweeping for offenders after a route rename.

### Related Skills

- vendor `remix` skill (`.opencode/skills/remix/SKILL.md`) — canonical route trees, controllers, frames, and `context.render` APIs these deltas build on
- `remix3-tooling § Build & Tooling` — `public/` client-entry colocation and the relative-import-depth checklist a route move triggers, plus the CLI route-tree discovery note
- `remix3-forms § Validation Errors` — the full `parseSafe` + `context.render` validation-error pattern the relocation upgrade points at
- `remix3-server § Security` — client-IP trust and the two-tier model for SSE and standalone routes
- `remix3-server § Controllers` — `createController`/`createAction`, context keys, and controller consolidation
- `remix3-ui § Frames` — `<Frame>` navigation and `clientEntry` hydration behind the frame-to-full-page moves

---

## File Uploads & Downloads

_(formerly `remix-file-uploads` — references live under `references/remix-file-uploads/`)_

For the streaming multipart parser, size limits, and the pluggable storage backends (`remix/file-storage/fs`, `s3`, `memory`), see the vendor READMEs: `node_modules/remix/src/multipart-parser/README.md`, `node_modules/remix/src/form-data-parser/README.md`, `node_modules/remix/src/file-storage/README.md`, and `node_modules/remix/src/form-data-middleware/README.md`.

This skill only documents the hard-won deltas: storing files directly in a PostgreSQL `bytea` column, the middleware-ordering gotcha it exposes, the streaming-parser error-handling pattern (reject-without-throwing + wrapping `formData()` for never-suppressed limit errors), streaming to `remix/file-storage/fs` with the `/future` parser, and the report-export pattern.

Upstream also ships opt-in `/future` streaming entrypoints (`remix/multipart-parser/future`, `remix/form-data-parser/future`, `remix/middleware/form-data/future`) that stream parts/uploads to the handler instead of buffering. The app uses **both** paths: `/admin/uploads` keeps the stable buffered parser and stores bytes in PostgreSQL `bytea` (per-user/total quota, retention sweep), while `/admin/uploadnew` uses the future parser + `remix/file-storage/fs` and indexes filename/type/size/owner in the metadata-only `upload_files` table (§7). Read the vendor README "Future API" sections before changing either path.

### Load Only The References You Need

| Task involves... | Start with |
| --- | --- |
| Upload endpoints, storage, ordering, rejection handling (the deltas below) | this file, §1–§4 |
| Bulk ZIP download without a dependency | this file, §6 |
| Adding a PDF/CSV export to an existing list/report page — sharing the page's parser, a static child route, and the `data-rmx-document` / `X-Remix-Frame` traps | `references/remix-file-uploads/report-pdf-export.md` |

### Working implementations in this repo

- `app/middleware/uploads.ts` — the `uploadFormData()` wrapper (limit-error PRG), the `fileUploadErrorMessage()` validator, and the stable `uploadHandler` streaming parser writing to `bytea`.
- `app/middleware/upload-files.ts` — the `/future` streaming handler for `/admin/uploadnew`: request-scoped storage keys (`uploadFilesScope` / `takeStoredFileKeys` / `takeUploadFilesError`), quota pre/post checks, post-store byte sniffing, the `upload_files` insert with compensating file removal, and the shared `uploadLimitErrorCode` mapping.
- `app/storage.ts` — `createFsFileStorage` backend + `UPLOAD_FILES_DIR`, resolved against the app root and rejected inside `public/`.
- `app/data/upload-files.ts` — the metadata-only `upload_files` index (no `bytea`), `SUM(size)` quota, listing/count, and delete-returning-storage-key.
- `app/actions/admin/uploadnew/controller.tsx` — admin-only streaming upload page, DB-backed list, lazy-file download, and delete (row first, file second).
- `app/middleware/upload-claim.ts` — the `AsyncLocalStorage` scope (`uploadClaimScope` / `addUploadedId` / `takeUploadedIds` / `setUploadError`) that carries server-generated upload ids through the request.
- `app/data/uploads.ts` — `uploads` schema, `insertUpload`, quota queries.
- `app/utils/zip.ts` (+ `app/utils/zip.test.ts`) — the `buildZipArchive` implementation (see §6).
- `app/actions/admin/uploads/controller.tsx` — uploads controller (upload + bulk download routes).
- `app/middleware/root.ts` — middleware ordering (`session()`/`asyncContext()`/`loadDatabase()`/`loadAuth()` before `uploadClaimScope()`/`formData()`; `skipCsrf()` stays after the parser because the token lives in the parsed form).

### The deltas

#### 1. Middleware ordering is load-bearing

The root chain resolves the session and auth **before** the upload parser, so `uploadFormData()` can reject an unauthenticated multipart POST to the uploads action with `401` before `formData()` reads a byte. It also applies the app's `isAllowedCsrfOrigin()` origin/`Sec-Fetch-Site` check **before** parsing (`403`), closing the gap where a cross-site form could reach `uploadHandler` with the victim's session cookie before `skipCsrf()` saw the token. Multipart bodies on other actions still parse (JavaScript `fetch(FormData)` uses multipart for ordinary forms), but they use a parser **without** the storage handler. This is a pre-parse guard only: the parser still runs before route-level `requireAuth()`, so `uploadHandler` still inserts with `uploaded_by = null` and the controller claims the row after auth. The `AsyncLocalStorage` scope must be installed **before** `formData()` (the handler runs during body parsing, so the scope must already exist):

```
session(cookie, storage),
asyncContext(),
loadDatabase(),
loadAuth(),
uploadClaimScope(),
formData({ uploadHandler, maxFileSize: 50 * 1024 * 1024 }),
// methodOverride(), jsonBody(), skipCsrf() …
```

`skipCsrf()` cannot move ahead of `formData()`: `csrf()` reads the token from `context.get(FormData)`. If a future change needs full CSRF-before-parse protection, add `cop()` (origin/`Sec-Fetch-Site`) in front of the parser rather than reordering `csrf()`.

#### 2. Auth fixup — server-side request scope, NOT the form field

⚠️ **The `file` form value is attacker-controlled.** Claiming `uploaded_by` from `context.formData.get('file')` — even with a scoped `(uploaded_by IS NULL OR uploaded_by = $1)` guard — lets any authenticated user steal any unclaimed upload by POSTing a plain text field `file=<victimId>` (no file part, so `uploadHandler` never runs). See `remix3-server § Security` (`references/security-gotchas/idor-scope-write-bypass.md`).

Claim ownership only from the server-scoped id: the handler calls `addUploadedId(id)` per accepted file, and the controller drains the whole batch with `takeUploadedIds()` in one quota check. See `app/middleware/upload-claim.ts`.

#### 3. Reject a file without throwing — return `void` + record the reason

Never throw inside `uploadHandler` for an expected rejection (unsupported type, invalid name, too large) — a throw escapes the global `formData()` middleware into an uncaught 500 (see §4). Return `void` and record a reason in the upload-claim scope instead (the repo's `fileUploadErrorMessage()` in `app/middleware/uploads.ts`).

Detection is by request shape, never `instanceof File` (which is always `false` for a file part): `takeUploadedIds().length === 0` **and** `Content-Type` starts with `multipart/` → the upload was rejected. Claim a whole multi-file batch in one quota check, so a near-quota user can't slip files through by claiming last.

#### 4. Multipart limit errors are NEVER suppressed — wrap the global `formData()`

`suppressErrors: true` only swallows malformed-body parse errors; multipart **limit** errors (`MaxFileSizeExceededError`, `MaxFilesExceededError`, `MaxPartsExceededError`, `MaxTotalSizeExceededError`) always propagate. And since `runMiddleware` has no catch, a throw inside `formData()` prevents the rest of the chain (`methodOverride`, CSRF, render, controller) from running, so the controller can't render a friendly page — you get an uncaught 500 + stack trace. Auth and database context now sit before the parser, so a limit error no longer takes those down; it still skips routing/render.

Wrap `formData()` and short-circuit with a `Response` (you cannot "continue" the chain after a downstream middleware throws). For the uploads POST, Post/Redirect/Get to the same path resolved as a GET, carrying an `uploadError` code. See the `uploadFormData()` wrapper in `app/middleware/uploads.ts`.

⚠️ **Keep the `Middleware<{ key: typeof FormData; value: FormData; property: 'formData' }>` context transform on the wrapper.** A bare `Middleware` (default empty transform) drops it and `context.formData` stops existing in the derived `AppContext` — every consumer across the app fails tsc with TS2339 'Property `formData` does not exist'.

Keep `maxFileSize` on `formData()`: it is your per-part **memory bound** (removing it lets the parser buffer an unbounded file → OOM). Enforce the product limit in the handler (return `void`); files over the `maxFileSize` cap surface through the wrapper's redirect.

#### 5. Download endpoint

Use a standalone `createAction` route — not nested inside `form()` — that turns the stored row into a `File` and returns `createFileResponse(file, request, { cacheControl: 'private, no-cache' })`. The helper supplies `Content-Type`/`Content-Length`, ETag, `Last-Modified`, conditional requests, `HEAD`, ranges, and `X-Content-Type-Options: nosniff`; `private` keeps owner-scoped downloads out of shared caches and `no-cache` revalidates the stable URL. Set `Content-Disposition` separately: ASCII names use `filename`, non-ASCII names add an RFC 8187 `filenameSplat` (`UTF-8''…`) alongside an ASCII fallback. Use `private, no-store` for generated ZIP archives. See the uploads controller in `app/actions/admin/uploads/controller.tsx`.

#### 6. Bulk ZIP download without a dependency (`node:zlib`)

Zipping usually means adding `archiver`/`jszip`. When you only need a simple archive (a handful of entries, deflate), `node:zlib`'s `deflateRawSync` is exactly what a ZIP entry stores — build the container by hand (three regions: 30-byte local header + filename + deflated data per entry, one 46-byte central-directory header per entry, 22-byte end-of-central-directory record). The working implementation is `app/utils/zip.ts` (with `app/utils/zip.test.ts`); serve it as an attachment via `headers.contentType = 'application/zip'` + `headers.contentDisposition`, with `Cache-Control: private, no-store` because the archive contains owner-scoped files.

Verify against the real `unzip` tool (not just your own parser) before relying on it:

```sh
unzip -t out.zip   # "No errors detected in compressed data"
```

Gotchas:

- **Duplicate entry names** are legal but confusing — when two files share a name, prefix the later one (e.g. `${id}-${filename}`).
- **Non-ASCII filenames** need the UTF-8 flag (bit 11) set, or extractors mangle them.
- **Sync `deflateRawSync` blocks the event loop** — fine for a handful of entries, but a size guard is prudent for many large files.
- **Empty archive** is valid: just the 22-byte EOCD with `entries.length = 0`.

#### 7. Streaming to the filesystem with the `/future` parser

`/admin/uploadnew` is the worked example (`app/middleware/upload-files.ts`, `app/actions/admin/uploadnew/controller.tsx`). It streams each part into `createFsFileStorage(...)` instead of buffering, and the deltas are:

- **The handler runs inside the global parser, before routing and CSRF.** Register the `AsyncLocalStorage` scope **before** `formData()` (`uploadFilesScope()` in `app/middleware/root.ts`), and add the route's authorization to the pre-parse guard in `uploadFormData()` — an admin check at the action is too late to stop bytes reaching disk.
- **The action never trusts the form value for ownership/keys.** The handler returns a generated key, which becomes an ordinary form field; a client can submit the same field by hand. Record keys in the request scope (`takeStoredFileKeys()`) and report only those. Same IDOR shape as §2.
- **`FileUpload.size` throws until the stream has been read** and `slice()` is unsupported. Validate name/type before `set()`, then read the stored file back (`storage.get(key)` → `stored.slice(0, 16)`) to sniff magic bytes, and delete on mismatch.
- **Quota can only be checked after the write, and per-user admission needs a lock.** Pre-check both recorded totals before reading the body — global (`SUM(size) FROM upload_files`) and the uploader's own (`... WHERE uploaded_by = $1`) — to avoid writing when either is full. After `set()`, re-check the global total with `upload.size`, then admit the row through `insertUploadFileWithinUserQuota()`: it re-reads the owner's SUM and inserts in one transaction under `pg_advisory_xact_lock(userId)`, because without the lock two concurrent uploads both read the pre-insert total and jointly cross the cap. Remove the stored file when either check rejects. The per-user cap is `UPLOAD_FILES_PER_USER_QUOTA_BYTES` (default 100 MiB), read per call so a deploy/test can change it without a restart, and both the page hint and the rejection message render the same configured value. Keep the request bound explicit (`maxTotalSize` defaults to `maxFiles * maxFileSize + 1 MiB`, i.e. ~1 GiB for 20 × 50 MiB).
- **The DB row is an index, not the bytes.** `upload_files` has no `bytea` column: it stores the storage key and display metadata, while the file lives on disk. The backend's own `.meta.json` remains necessary — losing it makes the `.dat` unreachable even though the row exists.
- **Index after the stream, and compensate on failure.** Insert the row only after the content check; if the insert fails, remove the already-written file. A process crash between the write and the insert leaves an orphan (no row), so a reconciliation sweep should delete aged `.dat`/`.meta.json` entries with no matching row. Deletes run the other way: remove the row first, then the file, so a failed file removal leaves a reclaimable orphan rather than a row pointing at nothing.
- **Resolve the storage directory against the app root, not `process.cwd()`,** and reject it if it sits under `public/` — `staticFiles()` would otherwise serve uploads unauthenticated, bypassing the route's `Content-Disposition: attachment`.
- **Keep one extension→media-type table shared by client and server.** A global MIME allowlist lets the browser accept `.png` + `text/plain` while the handler rejects it; `app/utils/upload-validation.ts`'s `validateUploadMetadata()` + per-extension map is used by the browser entry, the `bytea` handler, and the streaming handler.
- **Tests clean two stores.** The future parser works through `router.fetch(url, { method: 'POST', body: formData })`; find fixture rows in `upload_files` by filename prefix, delete the row and then remove its storage key from the filesystem, and assert rejected uploads by absence of both the row and the file.

### References

- `node_modules/remix/src/multipart-parser/README.md` — streaming parser, limits, low-level API
- `node_modules/remix/src/form-data-parser/README.md` — higher-level FormData parsing middleware
- `node_modules/remix/src/file-storage/README.md` — storage interface and built-in backends
- `node_modules/remix/src/file-storage-s3/README.md` — S3 backend
- `node_modules/remix/src/form-data-middleware/README.md` — middleware that exposes `get(FormData)` in request context
- vendor `remix` skill (`.agents/skills/remix/`) — upload examples and middleware patterns
- `remix3-ui § Frames` (`references/remix3-frame-cliententry/frame-navigation.md`) — serving binary downloads through Frame navigation
- `app/middleware/uploads.ts`, `app/middleware/upload-files.ts`, `app/middleware/upload-claim.ts`, `app/storage.ts`, `app/data/uploads.ts`, `app/data/upload-files.ts`, `app/utils/zip.ts`, `app/actions/admin/uploads/controller.tsx`, `app/actions/admin/uploadnew/controller.tsx` — working implementations in this repo
- `references/remix-file-uploads/report-pdf-export.md` — sharing a report page's query parser with a PDF/CSV export, and the `data-rmx-document` / `X-Remix-Frame` download traps

---

## Request-Handling Security

_(formerly `security-gotchas` — references live under `references/security-gotchas/`)_

**Consolidated from:** `remix-security-middleware`, `remix3-two-tier-ip-trust-model`, `remix3-return-to-open-redirect`, `idor-scope-write-bypass`, `nodejs-path-traversal-guard`, `remix3-csp-inline-scripts`, `remix3-token-json-api-alongside-session`

This skill is the **index** for request-handling security deltas. For the framework middleware APIs themselves (`remix/middleware/csrf`, `cors`, `cop`, `session`), use the vendor `remix` skill (`.opencode/skills/remix/SKILL.md`) and the package READMEs it points at.

### Load Only The References You Need

| Task involves... | Start with |
| --- | --- |
| Every non-GET request returns 403 ("missing csrf token"), a webhook/SSE/agent POST needs to bypass CSRF, or a new `createAction`/`router.post()` route returns a bare 403 | `references/security-gotchas/security-middleware.md` |
| Choosing a client IP for a localhost guard, login rate limit, or admin allowlist vs. audit logging; `trustProxy` and `X-Forwarded-For` spoofing | `references/security-gotchas/two-tier-ip-trust-model.md` |
| Sanitizing a `returnTo`/`next`/`redirect` query param; an origin-only check still allows a path that normalizes to `//host` | `references/security-gotchas/return-to-open-redirect.md` |
| Fixing an IDOR by scoping reads, when a write path SETs the owner column or the row id comes from client input | `references/security-gotchas/idor-scope-write-bypass.md` |
| Restricting filesystem access to a project root; reviewing `path.resolve(x, y).startsWith(x)` or symlink escapes | `references/security-gotchas/path-traversal-guard.md` |
| An inline `<script>` is blocked by CSP, or a `clientEntry` loses early clicks to the async `import()` gap | `references/security-gotchas/csp-inline-scripts.md` |
| Adding a Bearer-token JSON API alongside session-authenticated routes — reuse the backend logic instead of duplicating it | `references/security-gotchas/token-json-api-alongside-session.md` |

### Core Rules

**CSRF / CORS / COP middleware (`references/security-gotchas/security-middleware.md`)**

- A globally installed `csrf()` validates **every** non-GET request: any `<form method="POST">` missing a hidden `_csrf` field gets **403 "Forbidden: missing CSRF token"** — add `<CsrfTokenInput />` (SSR-renders `<input type="hidden" name="_csrf">` from async request context). Default token sources are the `X-Csrf-Token` header then the parsed `_csrf` form field — the `_csrf` query-param fallback was **removed** in the pinned build (`a4d62e199`, upstream #11907), so a URL-only token is rejected unless you opt in with `value(context)`, which replaces both default lookups. CSRF requires session middleware.
- External endpoints cannot present a token, so wrap `csrf()` in a path-checking `skipCsrf()` (repo: `app/middleware/skip-csrf.ts`): `isExternalPath()` bypasses webhooks/API/callbacks entirely; `isAgentPath()` bypasses SSE/agent paths **only for GET** and requires `X-Sse-Request: 1` on non-GET (a cross-site `<form>` cannot set custom headers). New `createAction`/`router.post()` routes silently 403 with a bare status that looks like an auth/IP rejection — check `skip-csrf.ts` first. `clientEntry` forms inject the token from `<meta name="csrf-token">` on submit. `remix/middleware/cors` sets allowed origins; `remix/middleware/cop` is tokenless protection via browser provenance headers (`Sec-Fetch-*`).

**Two-tier IP trust model (`references/security-gotchas/two-tier-ip-trust-model.md`)**

- Split IP resolution in two: `connectionIp()` (trusted — the `X-Client-Ip` header stamped by `app/utils/server-handler.ts` from the TCP socket) for **security** decisions (localhost guards, login rate limits, admin allowlists), and `sourceIp()` (untrusted fallback chain `X-Client-Ip` → `Cf-Connecting-Ip` → `X-Forwarded-For` → `X-Real-Ip`) for **logging/audit/analytics only**. `X-Forwarded-For` and `X-Real-Ip` are client-spoofable (e.g. `X-Forwarded-For: 127.0.0.1` passing a localhost guard).
- `X-Client-Ip` is trustworthy **only with `trustProxy: false`**: `trustProxy: true` derives `client.address` from spoofable forwarded headers and re-enables the attack, unless a trusted reverse proxy strips/rewrites them. Always `set()` (not append) the header so a client cannot smuggle its own. Rate-limit on the socket tier; admin-only agent endpoints should skip IP and key on `auth.identity.id` with `perUser: true`.

**`returnTo` open redirect (`references/security-gotchas/return-to-open-redirect.md`)**

- An origin-only sanitizer still passes a same-origin value whose **pathname** starts with `//`: `new URL('//remix.local//evil.com', 'https://remix.local')` has origin `https://remix.local` but pathname `//evil.com`, and `Location: //evil.com` navigates to `evil.com` (protocol-relative). Reject unless the input `startsWith('/')`, then check **both** `url.origin !== baseURL` **and** `url.pathname.startsWith('//')`, and return `pathname + search + hash`. Upstream fixed the same class in `@remix-run/auth` `sanitizeReturnTo` (PR #11857); URL parsing already normalizes the backslash variant `/\evil.com` off-origin.

**IDOR ownership-claim write bypass (`references/security-gotchas/idor-scope-write-bypass.md`)**

- Scoping only READ queries does not fix an IDOR: an unscoped write that **SETs the owner column** (`UPDATE ... SET user_id = $1 WHERE id = $2`) lets any authenticated user claim any row by id, then read it through the newly-scoped path (e.g. `file=42` then `GET /resource/42`). Scope the claim to orphan-or-owned rows — `WHERE id = $2 AND (uploaded_by IS NULL OR uploaded_by = $1)` — and include the owner column in the WHERE of **every** DELETE/UPDATE path.
- That scoped claim is still bypassable when the row `id` is client-supplied (a plain-text `file=<victimId>` claims any unclaimed upload). Carry a **server-generated** id through a request-scoped channel instead: an `AsyncLocalStorage` scope middleware **before** the body parser (`uploadClaimScope()`), `addUploadedId(id)` after `INSERT … RETURNING id` in the upload handler, and post-auth claim only `takeUploadedIds()` — never `context.formData.get('file')`. `addUploadedId` must throw when the scope is missing so a middleware reorder fails loudly.

**Path-traversal guard (`references/security-gotchas/path-traversal-guard.md`)**

- `path.resolve(root, userPath).startsWith(root)` silently passes sibling directories sharing the root's prefix (`/home/project/my-app-leaks/.env` starts with `/home/project/my-app`), and `path.resolve` does not resolve symlinks. Use `path.relative(projectRoot, resolved)` and reject when `rel.startsWith('..') || path.isAbsolute(rel)`; call `realpathSync(process.cwd())` **once** at module load, and for read operations re-resolve the target with `fs.realpath` and repeat the `path.relative` check (a `node_modules/.bin/pkg` symlink to `/etc` otherwise escapes). In review, flag any `path.resolve(x, y).startsWith(x)` as a probable vulnerability.

**CSP inline scripts (`references/security-gotchas/csp-inline-scripts.md`)**

- A bare `<script>{code}</script>` is silently blocked by the `script-src 'self' 'nonce-...'` policy from `security-headers.ts`; render `<script nonce={getCspNonce()}>` so it executes synchronously on parse (no `clientEntry` `import()` timing gap that loses early clicks).
- The separate "content escaping" failure mode (`<`/`>` in JS string literals SSR-escaped to `&lt;`/`&gt;`) is **fixed upstream** (commit `8ddca1f04`, `escapeScriptTextContent()` now preserves `<`/`>` and only escapes `</script`/`<script` sequences), so only the nonce requirement remains; prefer `clientEntry` if the handler needs dynamic props or re-rendering.

**Token JSON API alongside session routes (`references/security-gotchas/token-json-api-alongside-session.md`)**

- Extract the shared CRUD into a data module (`app/data/<entity>.ts`), give the API its own controller with a token-auth guard and **no session/CSRF middleware**, wire it under `/api/` (the repo `app/middleware/skip-csrf.ts` `isExternalPath()` already exempts `/api/`), and refactor the session controller onto the same module. Keep body parsing, validation, status codes, and response format in each controller.

### When to Use

- You are reviewing or hardening request handling in a Remix 3 app: CSRF/CORS/COP middleware, client-IP trust, redirect sanitization, ownership scoping, filesystem paths, or CSP.
- A request returns 403 (especially a bare status on a new POST route), a redirect points at an attacker host, one user can read/claim another user's row, a path escapes the project root, or an inline script is blocked.
- Before shipping a new POST route, an IP-based auth/rate-limit check, an upload ownership claim, a file-serving endpoint, or an inline script.
- You are exposing existing CRUD through a shared Bearer-token JSON API while keeping the session routes unchanged.

### Related Skills

- vendor `remix` skill (`.opencode/skills/remix/SKILL.md`) — canonical CSRF/CORS/COP/session middleware and security-headers APIs
- `remix3-server § File Uploads` — the upload pipeline whose ownership claim must come from the server-scoped id, not the `file` form field
- `mastra-deltas § Agent Routing` — agent endpoints that need the SSE CSRF bypass and `X-Sse-Request` header
- `mastra-deltas § Agent` — SSE streaming endpoints (CSRF bypass only for GET, header guard on POST)
- `mastra-deltas § Tools` — approval-form endpoints that still need a CSRF token
- `remix3-server § Route Wiring` (`references/remix3-route-wiring/standalone-route-admin-sidebar.md`) — standalone admin routes that authenticate over SSE and extract the client IP
- `remix3-tooling § Bun Runtime` — Bun's `server.requestIP()` TCP-socket tier that keeps `X-Client-Ip` unspoofable
