---
name: remix3
description: "Use when working in this Remix 3 app — server routes/controllers (route contract, createController vs createAction, context keys, request pipeline, multipart/fs/bytea uploads, CSRF/IDOR/CSP, redirects), data (data-table findMany/count/create/write-returning, raw SQL, Postgres, migrations/checksum drift, parseSafe validation, forms, session.flash), UI (rendering, css()/@layer rmx.* overrides, @remix-run/ui primitives, theme tokens, motion/reduced motion, frames, clientEntries, hydration, JSX/SVG attributes), or tooling (asset server/remix.json, remix CLI/node-tsx, HMR, self-hosted fonts, Bun, remix test/Playwright). One learned-delta index consolidated from the former remix3-server, remix3-data, remix3-ui, and remix3-tooling skills; each section's table names the reference that owns the detail."
user-invocable: false
origin: consolidated
---

# Remix 3: Server, Data, UI & Tooling

This is the single learned-delta index for this app. It replaces the four former skills (`remix3-server`, `remix3-data`, `remix3-ui`, `remix3-tooling`) consolidated on 2026-11-26; their reference namespaces are unchanged, so a pointer such as `remix3 § UI > Frames` names the same reference it did before. Detail, app seams, and version-pinned line refs live in the references. Everything vendor-supplied (the installed guides, package READMEs, the vendor `remix` skill, `@mastra/core` docs) is authoritative and linked, never restated.

## Load Only The Sections You Need

| You need... | Section | References |
| --- | --- | --- |
| Controllers, middleware, route wiring, uploads/downloads, request security | § Server | `references/remix-controllers/`, `references/remix3-route-wiring/`, `references/remix-file-uploads/`, `references/security-gotchas/` |
| data-table, Postgres, migrations, forms, validation | § Data | `references/remix3-data-table/`, `references/database-gotchas/`, `references/postgres-gotchas/`, `references/remix-forms/`, `references/form-error-handling-remix3/` |
| Rendering, styling, theme, motion, frames, clientEntries, JSX | § UI | `references/remix3-rendering-ui/`, `references/remix3-css-and-layout/`, `references/remix3-theme-conformance/`, `references/remix3-animation/`, `references/remix3-client-entries/`, `references/remix3-frame-cliententry/`, `references/remix3-jsx-attribute-conventions/` |
| Asset server, CLI, HMR, Bun, tests | § Tooling | `references/remix3-build-and-tooling/`, `references/remix3-bun-runtime/`, `references/remix3-testing/` |

---

## Server

Sections: Controllers & Middleware · Route Wiring · File Uploads & Downloads · Request-Handling Security.

Routes, controllers, middleware, uploads, and request-handling security. Canonical API: `node_modules/remix/guides/02-routing-and-controllers.md`, `node_modules/remix/guides/03-request-handling.md`, and the `remix/fetch-router` / `remix/render-middleware` READMEs.

### Load Only The References You Need

| Task involves... | Start with |
| --- | --- |
| `createController` vs `createAction`, `form()` routes, TS errors about `RouteMap`/`ActionRoute`, explicit generics, `Pick<AppContext, ...>` helper params | `references/remix-controllers/controller-routing-and-types.md` |
| A typed `context.<property>` from middleware, `Symbol` key errors, circular `AppContext` dependency flow | `references/remix-controllers/context-keys-and-dependency-flow.md` |
| Merging flat controller directories into a parent `controller.tsx` (names, imports, router, tests, `remix doctor`) | `references/remix-controllers/controller-consolidation.md` |
| Existing tests breaking after moving error handling into middleware | `references/remix-controllers/error-centralization-tests.md` |
| Route contract: `resources()`/`resource()` options (`only` vs this app's `exclude`), `patch`/`head`/`options` or any-method/bare-string leaves, nested-map registration and startup throws, `context.has`/`context.router`/request-only `context.headers`, a `/:id` leaf 500ing on `abc`/`1.5` | `references/remix-controllers/route-contract-and-controllers.md` |
| Request pipeline: `createRequestListener` options and the `(request, client)` arg, root middleware order, `RouterContext` vs `MiddlewareContext`, `request.body`/`request.signal`, cooperative aborts, raw SQL read checkpoints, the opt-in `REQUEST_TIMEOUT_MS` deadline | `references/remix-controllers/request-middleware.md` |
| `RoutePattern` is opaque and `.pathname.tokens`/`_parts` access breaks; you need the pattern's variables/wildcards | `references/remix-controllers/route-contract-and-controllers.md` |
| Constructing or parsing HTTP headers with the typed `remix/headers` classes (Content-Disposition quoting, `Content-Length`, browser-safe `ContentType`) | `references/remix-controllers/headers.md` |
| Adding a standalone route (webhook/API/SSE) and linking it from the admin sidebar; `renderAdminPage()` crashes or renders blank; an SSE endpoint returns 401 instead of a redirect | `references/remix3-route-wiring/standalone-route-admin-sidebar.md` |
| Moving a route between trees (admin frame-sidebar ↔ top-level, frame ↔ full-page); keeping the old URL alive; frame removal; upgrading form validation to `parseSafe` + `context.render`; deleting a route | `references/remix3-route-wiring/route-relocation.md` |
| Converting hardcoded `href`/`action`/`src` strings to the typed `routes.*` tree, or auditing after a route rename | `references/remix3-route-wiring/typesafe-url-audit.md` |
| Upload endpoints, storage, ordering, rejection handling | this file, § File Uploads & Downloads §1–§5 |
| Bulk ZIP download without a dependency | this file, § File Uploads & Downloads §6 |
| Adding a PDF/CSV export — sharing the page's parser, exporting client-held view state, bounding pdfmake's `break-all` cost, `data-rmx-document` / `X-Remix-Frame` traps | `references/remix-file-uploads/report-pdf-export.md` |
| An unsafe request returns 403, a webhook/SSE/agent POST needs to bypass CSRF, or a new POST route returns a 403 body that looks like auth/IP | `references/security-gotchas/security-middleware.md` |
| Choosing a client IP for a localhost guard, login rate limit, or admin allowlist vs. audit logging; `trustProxy` and `X-Forwarded-For` spoofing | `references/security-gotchas/two-tier-ip-trust-model.md` |
| CSP-blocked inline script/style or `style="…"` attribute; CSP policy shape, reporting/Trusted Types, or the route-matrix test; `returnTo` open redirect; filesystem path traversal/symlink escape | `references/security-gotchas/security-checks.md` |
| Fixing an IDOR by scoping reads, when a write path SETs the owner column or the row id comes from client input | `references/security-gotchas/idor-scope-write-bypass.md` |
| Adding a Bearer-token JSON API alongside session-authenticated routes — reuse the backend logic | `references/security-gotchas/token-json-api-alongside-session.md` |

### Core Rules

**Controllers and middleware**

- Single-method routes (`get`/`post`/`put`/`del`) use `createAction` + `router.get/post/...`; `form()` routes use `createController` with `actions.index`/`actions.action` + `router.map()`.
- Context keys must be `object`s — use `createContextKey`, never `Symbol`.
- Keep the `createController<typeof routes.x, AppContext>` generic when a typed helper needs a specific middleware-provided type; prefer fixing the wrapper (`requireAuthenticatedUser<User>`) at the source.
- Type controller-helper params as `Pick<AppContext, ...>` of the members used, not the whole `AppContext` (whole-object assignment fails via `get()` method variance).
- Keep `app/middleware/root.ts` free of `router.ts`/controller imports so `AppContext` derives without a cycle.
- **Id-shaped inputs use `parseId` + a bound check — not `Number.isFinite`**: route params, query strings, and form fields are untrusted. `Number.isFinite(Number(param))` accepts `1.5`/`1e30`, which reaches an `int4` comparison and 500s with `invalid input syntax for type integer`. `parseId` (`app/utils/ids.ts`) returns `undefined` unless the value is a safe integer; guard with `id !== undefined && id > 0`. Regression: `?editing=1.5` → 200 with no edit panel (`app/actions/admin/admin-lists.test.ts`).
- A controller owns only the direct `Route` leaves of its map; register nested maps (`routes.appointment.types`) separately. A missing/unknown/nested key throws at `router.map(...)` (startup), not on first request. `controller.middleware` reaches only direct leaves, not a separately mapped nested map.
- Bare-string leaves are `Route<'ANY', ...>` — branch on `context.method`. `context.headers` is request headers, so return a `Response` for response headers; `context.router` re-enters the pipeline.
- `resources()`/`resource()` accept `exclude` as well as `only` (mutually exclusive; this app uses `exclude`). `appointment.types` is an explicit map because `resources()` hardcodes PUT for `update`.
- **Mutation methods:** PATCH for partial payloads, PUT for full editable forms, POST for commands. `RestfulForm` + `methodOverride()` support PATCH; `navigator.sendBeacon` cannot send it, so keepalive stays `fetch(..., { keepalive: true })`.
- **Retry-safe row actions:** submit the promised state in a hidden field, apply it, and no-op when already current; skip the write/audit/`token_version` bump and fall back for stale forms without the field.
- **RoutePattern is opaque:** use `.source`/`toString()`, `.toJSON()`, or `getRoutePatternCaptures(pattern)`; never `.pathname.tokens`/`_parts`. The parent-path rewrite is string-based: `route.pattern.source.replace(/\/[:*][^/]*$/, '/')` (`app/route-labels.ts`).
- **Typed headers:** pass clean values and let the class quote (do not pre-escape `Content-Disposition` filenames); `Content-Length` accepts a number; `ContentType` from `remix/headers/content-type` is browser-safe — prefer `ContentType.from(value).mediaType` over `split(';')`.

**Request pipeline**

- The app owns the 500 response via `renderServerError()` in `app/utils/server-handler.ts`, wired through `createRequestListener`'s `onError` in `server.ts`. `onError` bypasses the middleware chain, so the error page applies `applyHardeningHeaders()` itself and carries a static script-less CSP (`serverErrorContentSecurityPolicy`, `style-src 'unsafe-inline'` is the only exception) plus `Cache-Control: no-store`; keep those three in sync when changing the routed policy.
- Root order in `app/middleware/root.ts`: `securityHeaders()` → `csp()` → `compression()` → `staticFiles('./public', { index: false })`, then `session()`/`asyncContext()`/`loadDatabase()`/`loadAuth()` before the upload parser; `loadDatabase()` must precede `loadAuth()`, and `skipCsrf()` must stay after the parser because `csrf()` reads the parsed form. `securityHeaders()` owns non-CSP hardening/cache policy and collapses an exactly repeated CSP value; `csp()` (configured by `contentSecurityPolicy()`) owns the request nonce and policy. `render()` inherits the nonce for generated import maps, preloads, and CSS mixin styles; internal frame requests inherit it before child handlers run.
- `logger()` / `context.logger?.(...)` is the app logging channel. Derive `AppContext` with `MiddlewareContext<ReturnType<typeof createNewappMiddleware>>` and keep the `declare module 'remix'` augmentation; do not switch to `RouterContext<typeof router>` without inlining the chain.
- `request.body` is a Web stream (`app/middleware/json-body.ts` caps and cancels it); use `context.request.signal` for disconnect cleanup. Since #12446 the router checks the signal at layer boundaries but no longer races in-flight work, so pass the signal into the work that should stop. Never add a `Promise.race(query, abort)` wrapper around a driver that cannot cancel the query.
- `queryAbortScope()` runs after `requestTimeout()` and stores the combined client/deadline signal; `queryRows()`/`queryRow()` check it before `db.exec()` and after the query settles. Direct `db.exec()` calls are not automatic.
- `REQUEST_TIMEOUT_MS` opts into `app/middleware/request-timeout.ts` (504 on expiry, skips SSE); Hermes sends combine their own timeout with `context.request.signal` and record `aborted` on disconnect.

**Session storage**

- The fs store saves via temp file + rename (remix #12148), so an overlapping read never sees a partial session — do not re-add a per-operation serialization wrapper.
- The middleware reads before the handler and saves afterwards, so overlapping requests still overwrite each other's snapshot. `mergeSessionWrites()` (`app/utils/session-storage-merge.ts`) re-applies only this request's changed keys, including the `success`/`error` flash keys.
- `Session.data` is `[values, nextFlash]`, not the flash loaded for this request: consumed flash is readable only value-by-value through `get()` and cannot be enumerated. A merge/rebuild wrapper needs an explicit flash-key list, and those keys must not double as value keys.
- Rebuilt/merged flash must use `session.flash(key, value)`, never `createSession(id, [values, flash])` — the constructor's second element is already-consumed flash, so saving it writes `{}` and the message vanishes.
- `save()` returns the id only for a dirty session, `null` for a clean one (no `Set-Cookie`), and `''` for a destroyed one; `deleteId` marks a regenerated id whose old file must be deleted. A wrapper must delegate those states unchanged.
- `SESSION_DIR` overrides `tmp/sessions`; abandoned files are swept at boot and hourly (`SESSION_RETENTION_MS`, default 60 days). Tests keep the per-worker memory store.
- **Secret rotation needs more than one `secrets` entry.** `createCookie` signs with `secrets[0]` and verifies with the whole list, so `sessionSecrets(SESSION_SECRET, SESSION_SECRET_PREVIOUS)` always puts the current secret first and appends trimmed, de-duplicated retired values. Cookie-level regression must extract the `Set-Cookie` value with `SetCookie.from(...)` before building a request `Cookie` header.

**Route wiring**

- A route registered directly with `router.get()`/`router.post()` (or a named tree composed via `router.map()`) is **not** under the admin tree and cannot use `renderAdminPage()` — the admin layout Frame navigation makes that crash or render blank. Render it with its own `context.render(<Document …><Layout><Page /></Layout></Document>)` and link it from `app/ui/admin-layout.tsx` with `iframeNav: false`.
- SSE and other non-interactive endpoints cannot follow `requireAuth()` 302s: use `requireAdminSseAuth()` (plain **401** when auth is absent/invalid, **403** for a non-admin, pass-through for an admin session). Never `requireAdmin` on an SSE endpoint.
- **Relocating between trees:** move/remove the `routes.ts` entry and verify path nesting; keep the old URL alive with a same-origin redirect — `Location: routes.admin.index.href() + context.url.pathname + context.url.search`. Update `router.map(...)`; matching is specificity-sorted, so static children need not be registered before the parent `:id` — but add a test proving the static child hits its own handler. Add the route to the target nav, remove it from the old nav and `AdminNavItem` union, update `route-labels.ts`, then grep `old/path` across controllers, pages, forms, assets, and tests. Fix relative-import depth (`TS2307` after `git mv`). Preserve redirect status: `redirect(url)` defaults to **302**, so a frame-PRG handler that returned 303 must keep it.
- **Validation upgrade:** follow `§ Data > Validation Errors`; verify typecheck/tests, no stale `old/path` or `data-rmx-target`, every text input has `inputErrorStyle` + `fieldErrorStyle`, required DB fields have `minLength(1)`, DB-error catches re-render, and `route-labels.ts` is updated.
- **Deleting a route** is a wider sweep: route tree and frame name (`app/routes.ts` `frames`), `router.map(...)`, re-export, nav item/icon/`AdminNavItem`/`contentOnlyTargets`/`fullHeightTargets`, `IN_FRAME_REDIRECT_TARGETS`, `ROUTE_LABELS`, `FRAME_TARGETS`, `getSelfFrameTarget`, and `AGENT_PATHS`. Grep by the **frame name** as well as the path. Repair every reference before running tests — the runner loads every controller transitively and a missing import fails the entire run.
- **Typesafe URLs:** hardcoded `href`/`action`/`src`/`url`/`fetch`/`redirect`/`new URL` strings bypass the typed tree — sweep and convert to `routes.<tree>.<leaf>.href()`; a `form()` route resolves via `.index.href()`. Leave test fixtures, serialized-output assertions, and JSDoc examples alone.

**File Uploads & Downloads**

Working implementations: `app/middleware/uploads.ts`, `app/middleware/upload-files.ts`, `app/middleware/upload-claim.ts`, `app/storage.ts`, `app/data/uploads.ts`, `app/data/upload-files.ts`, `app/utils/zip.ts`, `app/actions/admin/uploads/controller.tsx`, `app/actions/admin/uploadnew/controller.tsx`.

Upstream ships buffered parsers plus opt-in `/future` streaming entrypoints. The app uses both: `/admin/uploads` keeps the stable buffered parser and stores bytes in PostgreSQL `bytea`; `/admin/uploadnew` uses the future parser + `remix/file-storage/fs` and indexes metadata in `upload_files`. Vendor API: `node_modules/remix/src/multipart-parser/README.md`, `form-data-parser`, `file-storage`, `form-data-middleware`.

1. **Middleware ordering is load-bearing.** The root chain resolves session/auth before the parser, so `uploadFormData()` can reject an unauthenticated multipart POST with 401 before `formData()` reads a byte, and applies the origin/`Sec-Fetch-Site` check (403) before parsing. The parser still runs before route-level `requireAuth()`, so `uploadHandler` inserts with `uploaded_by = null` and the controller claims the row after auth. `AsyncLocalStorage` scopes (`uploadClaimScope()`/`uploadFilesScope()`) must be installed **before** `formData()`. `skipCsrf()` cannot move ahead of `formData()` because `csrf()` reads the token from `context.get(FormData)`.
2. **Ownership comes from the server-scoped id, not the form field.** The `file` form value is attacker-controlled — `context.formData.get('file')` lets any authenticated user claim any unclaimed upload. The handler calls `addUploadedId(id)`, and the controller drains the batch with `takeUploadedIds()`.
3. **Reject a file without throwing** — return `void` and record a reason in the upload-claim scope (`fileUploadErrorMessage()`). Detection is by request shape, never `instanceof File` (always false for a file part): `takeUploadedIds().length === 0` **and** `Content-Type: multipart/*` means rejected. Claim a whole multi-file batch in one quota check.
4. **Status contract:** a stored upload answers `303` to the grid with `?uploaded=`; the GET restores the banner/highlight and a refresh cannot re-POST the body. A rejection that stored nothing re-renders at `400`; a partial batch redirects with accepted ids and flashes the rejection. Parse `?uploaded=` with `parseId`, bound it, and never trust it for ownership.
5. **Multipart limit errors are never suppressed.** `suppressErrors: true` only swallows malformed-body parse errors; `MaxFileSizeExceededError`/`MaxFilesExceededError`/`MaxPartsExceededError`/`MaxTotalSizeExceededError`/`MaxHeaderSizeExceededError` always propagate, and since `runMiddleware` has no catch they reach `onError` and render the 500 page. Wrap `formData()` and short-circuit with a Response (`uploadFormData()` PRG with `?uploadError=<code>`). Keep the `Middleware<{ key: typeof FormData; value: FormData; property: 'formData' }>` transform or every `context.formData` consumer fails tsc. Keep `maxFileSize` as the per-part memory bound; enforce the product limit in the handler.
6. **Downloads:** use a standalone `createAction` route and `createFileResponse(file, request, { cacheControl: 'private, no-cache' })` (ETag, Last-Modified, ranges, HEAD, nosniff). Set `Content-Disposition` separately; non-ASCII names add an RFC 8187 `filenameSplat`. Use `private, no-store` for generated ZIPs.
7. **Bulk ZIP without a dependency:** `node:zlib`'s `deflateRawSync` is exactly what a ZIP entry stores; build the local headers + central directory + EOCD (`app/utils/zip.ts`, `app/utils/zip.test.ts`). Set the UTF-8 flag (bit 11) for non-ASCII names, prefix duplicate names, guard size, and verify with `unzip -t`.
8. **`/future` streaming:** register the request scope before `formData()` and add route authorization to the pre-parse guard. The action never trusts form values for ownership/keys; record keys in `takeStoredFileKeys()`. `FileUpload.size` throws until the stream is read and `slice()` is unsupported — validate name/type before `set()`, read back via `storage.get(key)`, sniff magic bytes, delete on mismatch. Quota can only be checked after the write: pre-check global + per-user totals, then admit through `insertUploadFileWithinUserQuota()` (re-reads the owner SUM and inserts under `pg_advisory_xact_lock(userId)`). `upload_files` is an index, not the bytes; keep the backend `.meta.json`. Writes are staged/atomic since #11909. Index after the stream and compensate on failure; deletes remove the row first, then the file. Resolve the storage directory against the app root and reject anything under `public/`. Keep one extension→media-type table shared by client and server (`app/utils/upload-validation.ts`). Tests clean both stores.

**Request-handling security**

- A global `csrf()` validates every unsafe request; a form missing `_csrf` gets **403** `Forbidden: missing CSRF token`. Token sources are `X-Csrf-Token`/`X-Xsrf-Token`/`Csrf-Token`, then the parsed `_csrf` form field — the query-param fallback was removed. CSRF requires session middleware. External endpoints use `skipCsrf()` (`isExternalPath()` bypasses webhooks/API; `isAgentPath()` bypasses SSE/agent paths only for GET and requires `X-Sse-Request: 1` on non-GET). `clientEntry` forms inject the token from `<meta name="csrf-token">`.
- Split IP resolution in two: `connectionIp()` (trusted `X-Client-Ip` stamped from the TCP socket) for **security** decisions; `sourceIp()` (`X-Client-Ip` → `Cf-Connecting-Ip` → `X-Forwarded-For` → `X-Real-Ip`) for **logging/audit only**. `X-Client-Ip` is trustworthy only with `trustProxy: false`; always `set()` it, never append. Rate-limit on the socket tier; admin agent endpoints should key on `auth.identity.id` with `perUser: true`.
- **`returnTo` open redirect:** an origin-only sanitizer still passes `//evil.com` inside a pathname. Reject unless the input `startsWith('/')`, then check both `url.origin !== baseURL` and `url.pathname.startsWith('//')`; return `pathname + search + hash`.
- **Path traversal:** `path.resolve(root, userPath).startsWith(root)` passes sibling prefixes and does not resolve symlinks. Use `path.relative(projectRoot, resolved)` and reject `rel.startsWith('..') || path.isAbsolute(rel)`; `realpathSync(process.cwd())` once at module load, and re-resolve reads with `fs.realpath` and repeat the check.
- **CSP:** a bare `<script>{code}</script>` is blocked — render `<script nonce={getCspNonce()}>`. Styles split into `style-src-elem` (nonce), `style-src-attr 'none'`, and a `style-src` fallback; every authored `<style>` carries the nonce, a client-created `<style>` cannot, and `style="…"`/JSX style props are blocked (use `css()`/CSSOM). `script-src` has no `blob:` because entry/preload scripts are nonced. Reporting is `report-uri /csp-reports` with a capped/deduped/rate-limited controller; Trusted Types stays report-only until the vendor runtime emits TrustedHTML.
- **IDOR ownership:** scoping only reads does not fix an unscoped write that SETs the owner column. Scope the claim to orphan-or-owned rows (`WHERE id = $2 AND (uploaded_by IS NULL OR uploaded_by = $1)`) and include the owner column in every DELETE/UPDATE. When the row id is client-supplied, carry a **server-generated** id through the request scope instead.
- **Bearer-token API:** extract shared CRUD into a data module, give the API its own controller with token auth and **no session/CSRF middleware**, wire it under `/api/`, and refactor the session controller onto the same module. Keep body parsing/validation/status/response format in each controller.

### When to Use

- Adding or reshaping the route contract, wiring/debugging controllers, or editing `server.ts` / `app/middleware/root.ts`.
- Reading built-in action context or handling `request.body`/`request.signal`, timeouts, or raw SQL aborts.
- Adding/relocating/deleting a route between the admin frame tree and top-level pages, or converting URLs to `routes.*`.
- Adding uploads, downloads, ZIP/PDF/CSV exports, or a streaming upload path.
- Reviewing or hardening request handling: CSRF/CORS/COP, client IP, redirects, ownership, filesystem paths, CSP.
- A 403 on a new POST route, an open redirect, another user's row readable/claimable, a path escaping the root, or a blocked inline script.

---

## Data

Sections: Data-Table Grids & Writes · Database & Migrations · Postgres · Forms & Mutations · Validation Errors.

`remix/data-table`, Postgres, migrations, and forms. Canonical API: `node_modules/remix/guides/08-data-and-validation.md` and `09-forms-and-mutations.md`, plus the `data-table`/`data-schema` READMEs.

### Load Only The References You Need

| Task involves... | Start with |
| --- | --- |
| Querying by multiple IDs (`inList()`), a dynamic `orderBy` column (TS2322), or `db.count` rejecting a shared `WhereInput` (TS2345) | `references/remix3-data-table/query-patterns.md` |
| Raw-SQL grid (`sql`/`rawSql`/`db.exec`) needing safe sort + filter columns | `references/remix3-data-table/raw-sql-sort-filter.md` |
| A `sql` tag interpolates an array (`ANY(${ids})`, `IN ${ids}`), a composed fragment is bound as a record, or a `c.json()` write double-encodes | `references/remix3-data-table/sql-array-and-json-values.md` |
| `TableRow<typeof table>` won't assign to a UI row type (unknown json/bigint columns) | `references/remix3-data-table/row-adapter.md` |
| Insert/update needs the written row back, or an optimistic-concurrency update must detect a zero-row match | `references/remix3-data-table/write-returning.md` |
| A `validate`/`beforeWrite` hook silently passes, a one-sided paired-column update throws `DataTableConstraintError`, or required fields fail every partial `db.update` | `references/remix3-data-table/partial-writes-and-hooks.md` |
| Migration baseline via `db/migrations`, checksum drift/orphaned journal, `remix db rollback`, legacy-journal adoption, a data-repair/backfill migration, the rolled-back `up.sql` test, parallel-init catalog duplicate-key, or a config-backed pool without an `'error'` listener | `references/database-gotchas/migrations.md` |
| A controller catches a PostgreSQL constraint violation (`23001`/`23503`/`23505`/`23P01`), the adapter wraps the real error, or you must re-render the page with `formError` | `references/database-gotchas/database-errors.md` |
| A raw `db.exec` query returns untyped rows and you are about to write `as unknown as SomeRow[]`; decoding `int4`/`int8`/aggregate/JSONB/UUID columns | `references/database-gotchas/raw-sql-wire-honest-rows.md` |
| Any of: FK `ON DELETE` changes, `LIMIT` without `ORDER BY`, locale-dependent errors, `int8`/`BIGINT` strings, index-drop safety | `references/postgres-gotchas/gotchas.md` |
| Adding a `confirm()` dialog to server-rendered delete forms; intercepting a form submit before frame navigation; replacing native `confirm()` with the shell-mounted `@remix-run/ui/dialog` (`dialog.Portal`, `role="alertdialog"`, focus containment, `data-state` motion, focus restoration), reusing it from context-menu/bulk triggers, or freezing a bulk action's confirmed id set | `references/remix-forms/delete-confirmation.md` |
| Password confirmation (cross-field), keeping passwords out of `defaultValue`, visibility toggle (`data-toggle-pw`), the `app/ui` vs `app/assets` `clientEntry` trap | `references/remix-forms/password-forms.md` |
| One-shot UI state after a POST that must self-clear on refresh (`session.flash()` vs `session.set()`), or a session value mutated in place is missing on the next request | `references/remix-forms/session-persistence.md` |
| An agent tool decision or `ask_user` question must be resolvable without JS; a native `<form>` must post to an SSE-backed route, or a message composer must submit without JS | `references/remix-forms/native-form-on-sse-decision.md` |
| `parseSafe` + schema, value preservation, select fields, `coerce.number()`/empty-select and Postgres `number`-vs-string traps, the empty-string `""` select fallback, multi-source field precedence, code-based `errorMap` localization, `role="alert"`/`aria-invalid`/focus-first-invalid wiring, cross-field and wizard checks, validation tests | `references/form-error-handling-remix3/validation-and-schema.md` |
| `s.defaulted()` returning its default **without running the wrapped schema** — defaulted→required fields silently bypass validation; missing-field fail-fast and issue-message mapping | `references/form-error-handling-remix3/defaulted-skips-validation.md` |
| Admin CRUD grids: a shared `loadPageData`, `grid-state.ts` hidden inputs, `renderGridFormError` (status 400), error banners, partial updates with optional fields, open edit/create panel state | `references/form-error-handling-remix3/admin-grid-state.md` |
| Adding a new URL-query-param filter that drives a SQL `WHERE` (the 8+ touchpoint checklist), or separating status tabs from text search | `references/form-error-handling-remix3/url-param-filter-checklist.md` |

### Core Rules

**Data-table**

- **Multi-ID filter**: `where: inList('id', ids)`. Use `db.exec` + `= ANY($1)` only when input order must be preserved. In a `sql` tag on 3.3.0+, an interpolated array expands into `(?, ?)`: use `in ${ids}` or `rawSql('?', [ids])` for `= ANY(...)` (an empty array throws).
- **JSON columns write once**: `c.json()` serializes every non-null value with `JSON.stringify`. Pass arrays/objects directly; keep `JSON.stringify` only for raw-SQL parameters with an explicit `::jsonb` cast. Pre-serializing double-encodes.
- **Dynamic sort column**: narrow to a `SORTABLE_FIELDS` union and cast (`as ListSortColumn`, not `as any`); add a stable `['id','desc']` tiebreaker.
- **Raw-SQL sort/filter**: whitelist column identifiers, build `ORDER BY`/`WHERE` as `rawSql` fragments, parameterize values, and compile direction with the vendor `compileOrderByDirection()` (`remix/data-table/sql-helpers`).
- **Typed rows**: own one canonical row interface plus one adapter that narrows `unknown` json/bigint columns at a single boundary — no `as unknown as` at call sites.
- **Partial writes vs hooks**: `validate` receives the `beforeWrite`-normalized payload — check derived columns and gate required fields on `operation === 'create'`; merge one-sided paired-column updates before writing.
- **Filtered totals**: type a predicate used by both a grid query and `db.count` as `SingleTableWhere<typeof table>`; the broader `WhereInput` passes `findMany`/`paginate` but fails `CountOptions`. `paginate()` needs a separate count; shared error re-renders must carry the total.
- **Pagination bounds**: an untrusted `offset`/`page` must be a **safe integer** before `LIMIT/OFFSET` (`Number('1e30')` is finite but Postgres rejects it; `1.5` 500s an int4 comparison). Use `parseOffsetParam`/`parsePageParam` and `parseId`; clamp `paginate()` defensively.
- **Table metadata vs SQL**: `table()` nullability is a type claim, not a constraint. Keep it aligned and guard with `information_schema.columns` (skip generated columns) — `app/data/schema-alignment.test.ts`.
- **Raw SQL skips table hooks**: a `table()` whose reads/writes all go through `db.exec`/`queryRows` must not carry hooks. Keep the definition for the row type and decode at the raw-SQL boundary.
- **Return the written row at write time**: `db.create(..., { returnRow: true })`, `createMany(..., { returnRows: true })`, or `.update(changes, { returning: '*' })`. Returned rows already ran `afterRead` — adapters must be idempotent; MySQL lacks `returning`.
- **Decode `db.exec` rows** with wire-honest zod schemas (int4→number, int8→string) — `references/database-gotchas/raw-sql-wire-honest-rows.md`.
- **`exactOptionalPropertyTypes`**: widen pass-through optionals to `| undefined` instead of fighting the flag.

**Database & migrations**

- newapp builds the driver from a caller-owned `pg.Pool` and runs `db/migrate(..., { journalTable: 'app_migrations' })`; `test/setup.ts` creates a fresh test DB, resets `public`, then calls `initializeAppDatabase()`. The baseline `20261101000000_baseline/up.sql` is idempotent; the runner's advisory lock serializes parallel workers. A config-backed pool attaches no `pool.on('error')`; passing your own re-enables it but disables `wipe()`/`reset()`. Do not reintroduce `db/schema.sql` or the dedicated-`pg.Client` path.
- The runner journals and checksums each `up.sql`. Editing an applied migration throws `Migration checksum drift detected`; deleting it throws `Applied migration ... is missing`. Only `down` runs ignore orphans. Recovery: revert the edit, then `remix db rollback` (`--step`/`--to`/`--dry-run`), clearing the journal only last.
- **Adoption over a legacy journal:** isolate the runner in a distinct `journalTable`, make the first migration an idempotent baseline, keep `data_table_migrations` untouched, and test orphan adoption + `loadConfig()` parity.
- **Data repair:** harden readers first, then ship a per-row `DO $$` repair (type + prefix guard, `EXCEPTION` → `RAISE WARNING`, timestamps untouched, no-op `down.sql`). Test the applied `up.sql` inside a `db.transaction` and roll it back.
- An intermittent catalog duplicate (`pg_class_relname_nsp_index`/`pg_extension_name_index`) is an infra race: pre-initialize shared storage or serialize DDL with `--concurrency 1`.
- `Database` wraps native `pg` errors in `DataTableDatabaseError`, so the real `code` lives on `.cause`. Use `app/utils/db-errors.ts` (`isConstraintViolation` matches `23001` **and** `23503`; `isUniqueViolation` `23505`; `isExclusionConstraintError` `23P01`). `Database.exec()` rows are nullable (`rows ?? []`), use `affectedRows ?? 0` (no `rowCount`).
- In destroy/update/create actions, catch the constraint violation and **re-render** with `formError` + status 400; log a structured action-specific message and re-throw unexpected errors. Raw `BIGINT` arrives as a string — wrap in `Number()` before dates/comparisons. Date filters use UTC midnight (`Date.UTC(...)`), not `Date.now()`.
- **Wire-honest rows:** wrap `db.exec` in `queryRows`/`queryRow` (`app/data/rows.ts`) that zod-parse every row and throw naming the statement + row index. Keep wire rows (pg-native types, no hooks) distinct from domain rows (typed API, hooks applied). int4→`z.number()`, int8→`z.coerce.number()`, aggregates over int8/`::numeric`→coerced number, JSONB→record/array/unknown, bytea→`z.custom<Buffer>()`; check the baseline because not every id is int4.

**Postgres**

- **Idempotent FK change**: `DROP CONSTRAINT IF EXISTS`, then re-`ADD` inside a `DO $$` block guarded by `IF NOT EXISTS`; `ON DELETE SET NULL` requires a nullable column first. Run under a lock / one transaction.
- **`LIMIT` always travels with `ORDER BY`** (or a filtering `WHERE`); otherwise the row is arbitrary and tests fail as data accumulates.
- **Error text is locale-dependent**: set `lc_messages = 'en_US.UTF-8'` at database/connection level; session-level `SET` races on pooled clients.
- **`pg` returns `int8`/`BIGINT` as strings, `int4` as numbers**: decode with `z.coerce.number()` (shared `int8` schema), never `z.any()`/`z.union([number, string])`.
- **Zod 4 records**: `z.record(keySchema, valueSchema)` — the one-arg form is TS2554.
- **`idx_scan = 0` is not evidence an index is unused**: pair with the row count and grep the whole repo for the column and its `LIKE`/`ILIKE` operators. De-duplicate by access method (`ca.relam = cb.relam`); a `UNIQUE` constraint already owns its btree.

**Forms & mutations**

- `remix/data-schema` `.optional()`/`.nullable()` are **top-level functions**: `s.optional(s.string())`, not `s.string().optional()`.
- Delete confirmation must intercept at the **capture-phase click** (`{ capture: true }` + `preventDefault()` + `stopPropagation()`); a `submit`-phase listener can be preempted by frame navigation. A **bulk** confirmation freezes the id set and rewrites the payload in the form's `formdata` listener — Chromium builds the payload after `requestSubmit()` returns and can fire `formdata` more than once.
- Mount exactly **one** `<ConfirmDelete />` per document (`app/ui/document.tsx`), never per grid/row. It is now the shell-owned vendor `@remix-run/ui/dialog` (`dialog.Context`/`dialog.Portal`/`dialog.SurfaceContext`, `role="alertdialog"`, `data-state` motion, focus restoration), not a native `<dialog>`.
- When a dialog re-submits, call `form.requestSubmit(submitter)`, never `form.submit()`: `submit()` bypasses the `submit` event and the frame runtime.
- Never put `defaultValue` on password fields; exclude them from `readFormFieldValues` key arrays.
- `session.flash()` for one-shot UI state; `session.set()` for durable values. Session values persist only through `set()`/`unset()` — in-place mutation never marks the session dirty. Read-modify-write a **fresh** container.
- An SSE-backed decision endpoint can also accept a native form: render the resolved gate as `<form method="post">` (one form, per-button `formaction`), let the token-bearing form fall through `skipCsrf()`, drain the SSE response server-side, then `303` + `session.flash()`. Enhance by intercepting `submit` and reusing the stream.
- An `ask_user` multi-select posts the name repeatedly; normalize `formData.getAll('answer')` to a JSON array in the controller for both transports, wrapping only when the value does not already start with `[`.

**Validation errors**

- Use `s.parseSafe`, never `s.parse`. Localize built-in check messages through `parseSafe(..., { errorMap })` keyed on `context.code`; Standard Schema issues carry no `code`, so comparing the English message breaks on rewording.
- **`s.defaulted(chained, default)` returns its default without running the wrapped schema** — never wrap a required/validated field in it. Let missing fields fail the base type check and map the generic issue at the response boundary (`promptIssueMessage()`).
- Two controls for one setting: parse both as defaulted strings, select the source in a `.transform()`, then `.refine()` the selected value and `.transform()` back to the original shape.
- **Trim before length/format checks**: `.transform((value) => value.trim())` (`trimmedText()`), **before** `.pipe(minLength(...))`/`email()`. `minLength(1)` checks raw characters, so `"   "` passes and later 500s in a `beforeWrite` hook.
- **Untrusted grid ids/offsets**: `parseId`/`parseOffsetParam` before SQL; `Number.isFinite` accepts `1e30`/`1.5`.
- Extract raw `FormData` values **before** validation and pass them back as `formValues`; `formValues` take priority over row data. For optional update fields, use `formData.has(key)` so absence is real.
- Never overload one grid param: status tabs get `status`, free-text search gets `filter` (trimmed, LIKE-escaped, ORed with a numeric id). Navigation links re-append an open `editing`/`creating` panel.
- `<select value>`/`defaultValue` are supported (scalar or array), precedence `value` → `defaultValue` → option `selected`, string-matched. `defaultValue` is initialization-only, so a reused select still needs per-option `selected` or a `ref`.
- A cleared select submits `""`, and `"" != null` is true: normalize the preserved id to `""` and select a disabled placeholder, or the browser shows the first option while the error says required.
- Server-rendered errors need `role="alert"`, `aria-invalid`/`aria-describedby`, and a focus-first-invalid `clientEntry`.
- Validation re-renders use `{ status: 400 }` for full-page forms and every admin/Verwaltung grid editor; the frame transport renders HTML 4xx fragments.
- Keep `formError` (validation) and `error` (destroy flow) separate.
- App helpers: `app/utils/schema-utils.ts` (`issuesToFieldErrors`, `readFormFieldValues`, `trimmedText`), `app/utils/offering-schema.ts`, `app/utils/get-page-size.ts` + `app/ui/page-size-control.tsx`, `app/utils/grid-state.ts`, `app/utils/query-params.ts`, `app/ui/admin-grid-error.tsx` (`renderGridFormError`), and the guards `app/input-validation.test.ts` / `app/data/schema-alignment.test.ts`.

### When to Use

- Writing/debugging any data-table query, migration, constraint handling, or raw `db.exec` decode.
- A query is too slow, a typed API rejects a `where`, a partial write fails, `int8`/JSON comes back wrong, or a migration checksum/orphan blocks boot.
- Adding validation to a form action, preserving values/errors, or preserving admin grid state across a failed POST.
- A `confirm()`/dialog flow, password form, session flash that will not clear or persist, or a no-JS path for an SSE-backed route.
- A defaulted field silently passes validation, a whitespace-only value 500s, or a select shows the wrong option.

---

## UI

Sections: Rendering · CSS & Layout · Theme Tokens · Animation & Motion · Client Entries · Frames · JSX Attribute Conventions.

Rendering, `css()`/`@remix-run/ui`, theme tokens, motion, frames, and client entries. Canonical API: `node_modules/remix/guides/04-rendering-ui.md`, `05-interactivity.md`, `06-streaming-ui-with-frames.md`, `07-animation.md`, and the `@remix-run/component` / `@remix-run/ui` READMEs.

### Load Only The References You Need

| Task involves... | Start with |
| --- | --- |
| Sharing a value with descendants (`handle.context`), a stable DOM id (`handle.id`), or a browser-reactive context value (`TypedEventTarget`) | `references/remix3-rendering-ui/component-context-and-handle-id.md` |
| Adding to `<head>` (meta/og, modulepreload, styles, CSP nonce), wiring the browser entry/import map, or `context.render(tree, ResponseInit)` | `references/remix3-rendering-ui/document-shell-and-asset-entry.md` |
| Choosing between app-owned `css()` and an `@remix-run/ui` primitive, or whether to wrap/replace a vendor component | `references/remix3-rendering-ui/first-party-ui-blocks.md` |
| Rendering raw HTML through a prop (`innerHTML`, iframe `srcDoc`/`srcdoc`) and `Framework invariant: Invalid … prop` after a bump | `references/remix3-rendering-ui/unsafe-html.md` |
| Returning an HTML string outside the component runtime (standalone error pages, frame fragments, email/RSS), with XSS-safe interpolation | `references/remix3-rendering-ui/html-template.md` |
| A hover/focus reveal stays pinned open, two toolbars show after a reorder (`:focus-within` trap), or a row-action overlay appears on row hover | `references/remix3-css-and-layout/hover-reveal.md` |
| A `css()` override silently loses to vendor rules (double borders, wrong divider colour, `& > *` ignored) while siblings apply | `references/remix3-css-and-layout/cascade-layer-overrides.md` |
| An inline icon/glyph sits on its own line; a link/span containing an SVG wraps vertically | `references/remix3-css-and-layout/svg-reset-inline-wrap.md` |
| A native `<select>` overflows its flex row because of long option text | `references/remix3-css-and-layout/native-select-flex-contain.md` |
| A content-sized flex-column panel/card collapses to its header; a bounded full-height shell under-sizes | `references/remix3-css-and-layout/content-sized-flex-panel.md` |
| A viewport-bounded page/grid stops scrolling after a bump; `css({ flex: 1 })` serializes as basis `0%`; an inner list/sidebar is clipped by an `overflow: hidden` wrapper | `references/remix3-css-and-layout/bounded-scroll-flexchain.md` |
| Filling the available height in an admin sidebar shell; `height: 100vh` overflows the stacked chrome | `references/remix3-css-and-layout/full-height-sidebar-shell.md` |
| A plain-`Layout` (no sidebar) grid shows a page scrollbar; header/filters pinned and only rows scroll | `references/remix3-css-and-layout/plain-layout-bounded-grid.md` |
| A nested scroll container keeps/clamps its offset after a frame navigation; a grid jumps when paging | `references/remix3-css-and-layout/nested-scroller-navigation-reset.md` |
| `hidden` / `toggleAttribute('hidden', …)` has no visual effect; an author `display` overrides the UA `[hidden]` rule | `references/remix3-css-and-layout/hidden-attribute-display-override.md` |
| An admin grid overflows on mobile/hides row actions, the two-column edit panel clips columns, or stacked-card cells keep table padding/borders/ellipsis | `references/remix3-css-and-layout/admin-grid-responsive-panels.md` |
| An admin grid's actions column overflows, a kebab-revealed cluster should reclaim width, or a `css()` breakpoint override does nothing | `references/remix3-css-and-layout/floating-row-actions.md` |
| A desktop-only hide keeps an element visible, a narrow mouse window keeps the touch layout, or a breakpoint flips test focus/visibility | `references/remix3-css-and-layout/responsive-show-hide.md` |
| Understanding the six ways styling drifts, or the app's theme files | `references/remix3-theme-conformance/failure-modes.md` |
| Choosing/importing a token, or a token that does not exist yet | `references/remix3-theme-conformance/token-rules.md` |
| A low-contrast or invisible label, badge, glyph, or destructive-outline button | `references/remix3-theme-conformance/contrast-verification.md` |
| Vendor `light-dark(...)` palettes ignore the app `data-theme` toggle | `references/remix3-theme-conformance/light-dark-color-scheme.md` |
| Building style strings by hand in `clientEntry`/browser DOM code (incl. `var(${theme.…})` re-wrapping) | `references/remix3-theme-conformance/cliententry-dom-styling.md` |
| What `npm run lint` enforces, a past light/dark incident, or the `theme.<group>.<key>` → `--rmx-*` mapping | `references/remix3-theme-conformance/metadata.md` |
| Adding an icon/glyph missing from the theme set, or a `GlyphValues` type error | `references/remix3-theme-conformance/glyph-add.md` |
| Motion values, entrance/exit/layout animation, reduced-motion gating, View Transitions, WAAPI/`transitionend` teardown | `references/remix3-animation/gotchas.md` |
| A DOM op (focus, scroll, measure) must run after `handle.update()`; `requestAnimationFrame` steals focus or fires after a re-render | `references/remix3-client-entries/queuetask-over-raf.md` |
| A page works in Chromium but client entries fail in Firefox (`Multiple import maps are not allowed.`, `[createFrame] Failed to load module`); a server-hydrated textarea renders empty only in Firefox | `references/remix3-client-entries/firefox-single-import-map.md` |
| Same-page sections should show one at a time, deep-link via hash, and support Arrow/Home/End; `hidden` panels do not hide; the page flashes before the entry hides inactive panels | `references/remix3-client-entries/aria-tabs.md` |
| A server-hidden element must reappear when scripting is disabled; a `<noscript>` or `<html data-*>` fallback goes live / gets wiped after a client patch | `references/remix3-client-entries/nojs-fallback-scripting-media.md` |
| A frame-swapped status/success message is visible but not announced, or you are adding a live-region announcer | `references/remix3-client-entries/persistent-live-region.md` |
| Replacing a hand-rolled drawer with native `<dialog>` + `showModal()`; Escape/backdrop/scroll-lock/focus tests flake; a re-render replaces the trigger or the open dialog (confirmations use the shell vendor `@remix-run/ui/dialog` instead — see § Data > Forms & Mutations) | `references/remix3-client-entries/native-dialog-drawer.md` |
| A `clientEntry` needs a client-only mount, a custom event mixin, code-driven navigation, cancellation granularity, stable keys/input ownership, or enhanced form submission | `references/remix3-client-entries/interactivity-runtime.md` |
| A click/submit guard must ask before discarding unsaved edits, but the confirmation is an async dialog; the navigation must be replayed and a frame swap replaces the guarded form | `references/remix3-client-entries/dirty-navigation-guard.md` |
| An imperative helper (toast/confirm) needs a component-owned host; overlays must escape a scroller, transformed ancestor, or frame; one stack must span entries | `references/remix3-client-entries/shell-overlay-portal.md` |
| Building keyboard-navigable rich lists (roving tabindex, nested controls, focus-by-id reorder, safe re-init) | `references/remix3-client-entries/roving-tabindex-keyboard-lists.md` |
| A `/lists`-style editable list: view-only filters/sort vs persisted order, undo across an in-flight PATCH, touch kebab, bulk actions, searchable target picker, sticky-sidebar dialog, help sheet/mobile fold, sidebar state | `references/remix3-client-entries/lists-editor.md` |
| Setting an input/textarea value programmatically and the `maxLength` cap must still hold | `references/remix3-client-entries/maxlength-programmatic-value-bypass.md` |
| Streaming agent/LLM text into a chat bubble and rendering markdown only once the stream settles | `references/remix3-client-entries/streamed-chat-markdown-finalize.md` |
| Raw JSON/`[object Object]` in agent chat, a tool result overwriting the final text, repeated empty cards, or a turn ending with tool cards | `references/remix3-client-entries/streaming-chat-tool-results.md` |
| A `clientEntry`/`.browser.tsx` has grown past ~1,000 lines and mixes state, DOM, network, styles, and JSX | `references/remix3-client-entries/client-entry-decomposition.md` |
| The entry's fetch/SSE turn state machine must become independently testable / stop touching DOM | `references/remix3-client-entries/stream-controller-extraction.md` |
| Several `clientEntry`s repeat the same entry body and must be deduplicated without breaking hydration | `references/remix3-client-entries/client-entry-factory-extraction.md` |
| An enhancer entry renders `null`/a hidden div, scans server DOM, and registers module-scoped listeners; converting it to component-owned DOM | `references/remix3-client-entries/component-owned-dom-conversion.md` |
| Per-element `ref()` event wiring should become one delegated browser-only `createMixin(type, { ssr: false })` | `references/remix3-client-entries/browser-only-behavior-mixin.md` |
| Adding `data-rmx-prefetch`/`prefetch()` link warming, or a prefetch cost a second SSR because `run({ resolveFrame })` replaces the default resolver | `references/remix3-client-entries/frame-prefetch-cache.md` |
| Form interception in frames, `resolveFrame`, frame direct render, `data-rmx-document`/`data-rmx-history`, nested-frame PRG redirects | `references/remix3-frame-cliententry/frame-navigation.md` |
| `clientEntry` cascade limits, `mounted` guards after reload, the hydration-marker wait rule, reload-driven data loading, `reloadStart`/`reloadComplete`, keeping focus across a frame reload, focusing a server-rendered error, gating live search beside a dirty-guarded panel, global listeners, SSR safety, SSR-from-props | `references/remix3-frame-cliententry/cliententry-lifecycle.md` |
| Styling clientEntry children, joined button groups, inline-edit table cells, `on` hydration, drag-and-drop, fragment scrolling | `references/remix3-frame-cliententry/cliententry-dom-and-styling.md` |
| Frame target registration/content-only panels, nested registration, `<input>` `defaultValue` preservation, asserting on frame HTML, timing an e2e click after registration | `references/remix3-frame-cliententry/frame-layout-and-testing.md` |
| Deferring frames until visible (`Frame loading="lazy"`), collapsed/offscreen content, measuring fan-out | `references/remix3-frame-cliententry/lazy-frames.md` |
| A frame-targeted form POSTs to a method-only route (frame GETs it → 404), or a racing SSE invalidate-reload crashes | `references/remix3-frame-cliententry/frame-form-action-get-route.md` |
| Converting a clientEntry tab/panel switcher to frame navigation, a POST message vanishing because the frame came from a separate GET, or whether a frame conversion reduces code | `references/remix3-frame-cliententry/frame-server-view-switching.md` |
| A frame-shell page shows the breadcrumb/page name twice on a full GET | `references/remix3-frame-cliententry/frame-shell-duplicate-breadcrumb.md` |
| A frame editor's "create new" mode has no server id and navigation would lose typed content | `references/remix3-frame-cliententry/frame-unsaved-draft.md` |
| A `session.flash` PRG message never appears in a frame fragment, or a test reads an empty session | `references/remix3-frame-cliententry/session-flash-frames.md` |
| A client-owned attribute on a reconciled element (root `data-theme`, `open`, custom) reverts after reload | `references/remix3-frame-cliententry/preserve-client-owned-attrs.md` |
| A frame fails/cancels or the resolver must choose fallback vs login; whether returned frame HTML is safe; `renderToString`/`renderWith`; a `data-rmx-src` link is not intercepted; native validation/`novalidate`; stale props after reload | `references/remix3-frame-cliententry/frame-failures-and-rendering.md` |
| Writing inline SVG (camelCase attributes do not render), or an `rmx-*` runtime attribute appears dead after a rename | `references/remix3-jsx-attribute-conventions/jsx-attributes.md` |

### Core Rules

**Rendering & composition**

- The shell is app-owned: `app/ui/document.tsx` plus request-scoped `getAssetEntry()` middleware state (the guide's `app/actions/document.tsx` + `scriptEntry` shape does not exist here). Global head/import-map/preload work belongs on document responses only — `loadAssetEntry` skips frame requests, so a fragment never has an entry.
- `handle.context` is **component-tree** context; the request context is the separate `remix/middleware/async-context` `getContext()`. Never mix them; `handle.context.set` schedules no render.
- Style the native control with `css()` before reaching for an `@remix-run/ui` primitive, and interactive controls need a `clientEntry` boundary. `button()` must keep upstream's `type="button"` default; an anchor styled as a button uses `buttonLink()` — never nest `<button>` in `<a>`.
- Raw-HTML props accept only the opaque `unsafeHTML()` value, which authorizes but does not sanitize. Outside the runtime, use the `html` tagged template; dropping the tag drops XSS escaping.

**CSS & layout**

- `css()` emits one `@layer rmx.<class>` sub-layer per class: **sub-layer order decides and specificity is irrelevant**, unlayered CSS beats every `rmx.*` layer, and the last sub-layer depends on class registration order — so the same override can win on one element and lose on its sibling. Fix on the target element, after the mixin, with `!important` for contested properties (or a genuinely later app layer), and verify with CDP, not `document.styleSheets`. A **parent's nested rule** (`&:hover .child`, `& tbody td`) lives in the parent's earlier sub-layer, so only properties the child's own style leaves unset apply.
- `css({ flex: 1 })` is `flex: 1 1 0%` since #12121: use `flex: '1 1 0'` in a viewport-fill chain and `flex: '1 1 auto'` in a content-sized column, and give **every** nested level `min-height: 0`. A `display: block` + `overflow: hidden` wrapper clips its `flex: 1` child instead of letting it scroll.
- An author `display` beats the UA `[hidden] { display: none }`, so a `hidden` toggle needs `&[hidden] { display: none }` in the same descriptor.
- Drive kebab-controlled row actions from the explicit trigger/overlay hover (`&:has([data-*-trigger]:hover, [data-*-actions]:hover)`) plus `:focus-visible`, never the whole row and never `:focus-within`. Make the overlay touch the trigger, drop the opacity transition so a reorder shows one cluster, and gate destructive actions separately instead of trapping clicks with `pointer-events`.
- A media key in `css()` must be the full query (`'@media (min-width: 1200px) and (hover: hover)'`); a bare condition in a constant is a silent no-op.

**Theme tokens**

- Reference tokens only through the typed `theme` object (`app/ui/theme/theme.ts`); never write `var(--rmx-…)` literals or hardcode a value a token covers. `theme.*` leaves **already are** `var(--rmx-…)` strings, so never re-wrap them: `var(${theme.…})` yields `var(var(--rmx-…))` and the parser drops the declaration.
- `.background` is a surface fill (pair with `.foreground`); text, glyphs, borders, and a native control's `accent-color` take `.foreground`.
- The contract (`app/ui/theme/contract.ts`) is the source of truth: a value defined only in `app/theme.tsx` resolves to `undefined` and its declarations are silently dropped. Add missing tokens to the contract **and** both `Theme`/`DarkTheme`.
- Contrast is verified by measurement (force `data-theme`, composite ink alpha × ancestor `opacity`), not lint.
- `light-dark()` follows the used `color-scheme`, not `data-theme`: map explicit dark/light to `color-scheme` on `<html>`, and represent explicit light as `data-theme="light"` (set, not removed).

**Animation & motion**

- `animateEntrance`/`animateExit` are mixins composed with `css()`/`on()`/`ref()` and need stable `key`s. Wrap configs in `app/utils/motion.ts` `entrance()`, which returns `false` under reduced motion (the app has no `animateExit` site after the vendor-dialog migration; add a matching helper only when one appears). Both are `ssr: false`, so server-rendered panels use the CSS keyframe `app/ui/mixins/panel-entrance.ts`. `animateLayout` has no app site: lists use a same-document View Transition and the message clamp a manual FLIP.
- The shell's reduced-motion guard (`transition: none !important` on `body` and `*`) beats inline `element.style.transition`, so every `transitionend` teardown needs a timeout fallback — and it does **not** cover WAAPI or explicit JS smooth scrolls, so `element.animate()` and `scrollIntoView({ behavior: 'smooth' })` must check `prefersReducedMotion()` themselves.
- Interruption is the default: handlers/mixins abort their own in-flight work; imperative code keeps the current `Animation` in setup scope and `cancel()`s before restarting.
- Since #12220 `animateExit()` starts synchronously in `beforeRemove`, so a `getAnimations()` snapshot right after close observes them; teardown/removal still settles asynchronously, so browser tests poll for DOM removal.
- Cross-document View Transitions are shell-owned (`app/ui/document.tsx` `@view-transition` under a no-preference guard; named `app-header`/`app-sidebar`) and only fire on real document navigations, never frame swaps. Same-document VT must feature-check `document.startViewTransition` and reduced motion.
- Reduced motion is not "no feedback" — prefer shorter fades, instant layout, or a non-motion state change.

**Client entries**

- `handle.update()` only from an event handler or `handle.queueTask()` — never from setup or render. Event handlers are supported; don't call it per `dragover`/scroll event, and the cascade guard is per component (50 updates in one turn), not frame-wide.
- Post-update DOM work (focus, scroll, measure) is a `queueTask`, not `requestAnimationFrame`: it is abortable on re-render. A task drains only on a render, so an entry that patches imperatively must `void handle.update()` after queueing; a focus restore queues **before** the update that renders the target.
- Register global listeners, observers, `matchMedia`, and `EventSource` in `handle.queueTask`, not setup: the queued task is a no-op during SSR, so it replaces the `typeof document` guard.
- `clientEntry(entryId, component)` only tags; hydration resolves the entry id's module `#ExportName`, not function identity. Keep `clientEntry(import.meta.url + '#Name', …)` at each call site; direct-render browser tests bypass hydration.
- A behavior that contributes no server HTML belongs in one delegated `createMixin(type, { ssr: false })` on a container, not per-element `ref()` wiring; under delegation `e.currentTarget` is the container, so row-scoped handlers take the row explicitly.
- A native `<dialog>` + `showModal()` owns the top layer, inertness, Escape (`cancel`), focus containment, and focus restore. Keep only the scroll lock and the trigger's `aria-expanded`; clean up idempotently from your own close path because `close` is queued, and observe `cancel`/`close` in the capture phase. Use it for the nav drawer and lists help/target-picker dialogs (device Back/`CloseWatcher`); the shell `ConfirmDelete` is the vendor `@remix-run/ui/dialog` stack, not a native `<dialog>`, so confirmations share the vendor focus/dismissal order.
- Imperative helpers cross into one shell `clientEntry` through a document `CustomEvent`; the host owns state and renders transient layers. Use vendor `menu.Portal`/`dialog.Portal` for vendor overlays, `OverlayPortal` only for app-owned shell layers (toast/flash) into `#app-overlay-root`, and native `<dialog>` for platform top-layer modals. Do not append a per-feature root to `document.body`.
- Firefox honors one import map: keep the `remix/multiple-import-maps-polyfill` wiring in `run()` and the nonced entry/preload scripts — dropping a nonce reintroduces the `blob:` requirement.

**Frames & hydration**

- Make the server route correct before layering frame/`clientEntry` interactivity. `app/assets/entry.tsx` (`run({ resolveFrame })`) is the always-loaded client runtime, not per-page user code: removing it drops enhancement back to full-document navigation.
- The app's `resolveFrame`, not the runtime, decides a non-2xx frame outcome: a 4xx body renders in the slot, a 5xx becomes a bounded `ErrorCard`, and a 401 becomes the full-page login redirect. The global `error` event sees only genuine runtime faults; `fallback` is the in-slot visibility mechanism.
- Returned frame HTML is reconciled without sanitization, and only a valid same-origin `src`/`data-rmx-src` is intercepted — anything echoed into a frame must already be escaped. Use `data-rmx-document` for cross-boundary transitions; do not disable the runtime.
- A `clientEntry` keeps its factory-closure setup state across a frame reload but receives fresh `handle.props` — read changing server values in render, never snapshot them into the closure.
- A frame must be mounted to be addressable (`handle.frames.get(name)` is `undefined` before mount), while a `<Frame>` in server HTML registers synchronously before any `clientEntry` hydrates. Programmatic navigation is `frame.reload({ src })`; `reload({ method, body })` submits form data without a history change.
- A frame-targeted form's action URL must also resolve as a GET (frame reload/SSE invalidate reissues GET to the action path); a method-only route produces a 404 or a fatal fragment diff. Do not "fix" it with `data-rmx-src`, which must handle the same method/body.

**JSX attributes**

- `remix/component` passes attributes through **verbatim** — no React-style translation, so SVG presentation attributes are kebab-case (`stroke-width`, `stop-color`).
- `ElementProps = Record<string, any>` means renames and typos compile, and render tests pass because they assert what a component *emits* rather than what the runtime *reads*. Verify runtime attribute contracts at the runtime layer: grep the installed package, sweep with a negative-lookbehind regex, add a render test, then exercise the browser flow.
- Since #12152 boolean `aria-*`/`data-*` serialize to `"true"`/`"false"` on server and client, so prefer boolean ARIA over a string ternary. Presence-based markers (`data-rmx-document`, `data-rmx-preserve-dom`, `popover`, boolean props) are unchanged — assert with `hasAttribute`; `value` is stringified.

### When to Use

- Editing the shell, head tags, preloads, import maps, or the browser entry; a fragment is missing its entry.
- A style/layout silently does nothing, loses a layer contest, collapses/clips a region, or a hover/focus reveal or `hidden` toggle misbehaves.
- Writing styles in a component, clientEntry, or browser DOM code; adding a badge/glyph/control; a token is `undefined` or `light-dark()` ignores the theme.
- A node appears/disappears/reorders and should animate; reduced-motion, WAAPI, or teardown handling.
- A DOM op must wait for `handle.update()`; a page works in Chromium but not Firefox; same-page sections need tabs; a drawer/modal migration flakes.
- A frame fails/is not intercepted/stale after reload; a clientEntry needs frames, prefetch, overlays, lists, streaming chat, or decomposition.
- Rendering inline SVG or debugging an `rmx-*`/`data-rmx-*` attribute.

---

## Tooling

Sections: Build, Assets & Tooling · Bun Runtime · Testing.

Serving, building, and testing. Canonical API: `node_modules/remix/guides/11-files-and-assets.md`, `13-testing.md`, `14-cli-and-tooling.md`, and the package READMEs.

### Load Only The References You Need

| Task involves... | Start with |
| --- | --- |
| Making `remix.json` the asset-server source of truth (`loadConfig` + spread `config.assets`), `mounts` vs the removed `fileMap`, `denyFiles` precedence, or debugging with `remix assets` / `remix assets inspect` | `references/remix3-build-and-tooling/assets-config-inspection.md` |
| Relocating `.browser.*` source into `<route>/public/`; `git mv` breaking relative imports; a `ui/` module importing a non-public `app/actions/**` module (`not-allowed`); tuning `allowFiles` | `references/remix3-build-and-tooling/browser-source-public-colocation.md` |
| Running `remix new`/`test`/`doctor`/`routes`/`version`/`completion`, programmatic `runRemix`, wiring `node --import remix/node-tsx` or `loadModule`, the `node-tsx` tsconfig, `remix test` filters, `NODE_ENV=test`, or mocking frozen ES-module exports | `references/remix3-build-and-tooling/cli-devops.md` |
| Wiring/debugging the `node-hmr` dev server (`npm run hmr`): fingerprint/watch conflict, IPv6 loopback, ready-gate hang, orphaned child, `trustProxy` | `references/remix3-build-and-tooling/hmr-dev-server.md` |
| Adding/replacing/auditing a webfont, a page still loads Google Fonts, serving `public/`, or tightening the CSP | `references/remix3-build-and-tooling/self-hosted-fonts.md` |
| A preview-pinned dependency may have upstream changes, judging an update, or pinning across the post-#11948 split lines (currently `v0.0.20261127-main-42167fd8`: `remix` 3.3.0 / `@remix-run/ui` 0.14.0 / `component` 1.3.0 / `component-hmr` 1.0.2) | `references/remix3-build-and-tooling/upstream-dependency-analysis.md` |
| Re-auditing the app against an installed guide chapter: chapter authored/renamed, a pin bump changed `node_modules/remix/guides`, or a learned delta looks stale | `docs/guide-chapter-audit.md` |
| `pnpm install` on the preview-pinned deps fails/crawls, or you need the current preview-release update flow | `docs/pnpm-remix-preview-installs.md` (historical recipes: `docs/history/pnpm-git-hosted-installs.md`) |
| Any Bun runtime divergence: `server.bun.ts`/IP, `test:bun`, SSR `handle.signal`, upload MIME, `@types/bun` programs, `bun run <bin>` | `references/remix3-bun-runtime/gotchas.md` |
| A `*.test.browser.tsx` needs geometry/media stubs, targets a full-page entry, must drive `reloadStart`/`reloadComplete`, or must drive `rmx:navigation` pending state | `references/remix3-testing/cliententry-browser-tests.md` |
| Parallel tests interfere despite ephemeral DBs; a test passes alone but fails in the suite; a shared-DB test fails even alone; another suite's unscoped `afterEach` deleted your fixture; a background timer swept it | `references/remix3-testing/parallel-test-interference.md` |
| A Playwright/browser harness failure: `networkidle` on SSE, unforgeable `location`, native `<select>` change, existence-only `waitFor`, external HTTP mock port, consecutive `mockImplementationOnce`, property/accessor mocks | `references/remix3-testing/test-harness-gotchas.md` |
| E2E is slow/flaky because it duplicates client behavior; deciding browser vs e2e | `references/remix3-testing/e2e-boundary-audit.md` |
| `&amp;` assertion failures, a crash card hiding the stack, destructive dev-server verification, or screenshots (repo `tmp/`, not `/tmp`) | `references/remix3-testing/testing-hygiene.md` |
| A rendered page needs content-model validation (`<a><button>`, `<h2>` in `<span>`, `<style>` in `<div>`) | `references/remix3-testing/rendered-html-conformance-html-validate.md` |
| A router test shares session/DB state, or an e2e needs `t.serve`/`createTestServer` wiring | `references/remix3-testing/state-isolation-and-e2e-serve.md` |
| A hover/focus-revealed control behaves differently with a real pointer vs programmatic `.click()`/`.focus()`, or focus retention across a reorder | `references/remix3-testing/input-modality-and-hover-testing.md` |

### Core Rules

**Build, assets, CLI**

- `git mv`-ing `.browser.*` into `app/actions/<group>/public/` breaks sibling relative imports (`TS2307`, silently un-bundled graph). Count depth back to `app/`, and keep `app/ui/**` broad in `allowFiles`: the **whole** graph must match, not just `public/`.
- `allowFiles` admits `app/ui/**`/`app/utils/**` but **not** non-public `app/actions/**`, so a `ui/` page importing an actions module leaves a dormant `reachable → not-allowed` edge. Move the shared value to `app/utils/` and re-export; confirm with `remix assets inspect`.
- `remix.json → assets` is the single source of truth; spread `config.assets` into `createAssetServer` via `loadConfig`. `fileMap` now throws — use directory-based `mounts`. `denyFiles` outranks `allowFiles`/`allowPackages`. Debug with `remix assets` / `remix assets inspect` (`AssetStatus`).
- `remix routes` reads only the export named `routes`; independently mounted named trees run but stay invisible. `remix test` takes a positional glob with `--type=server|browser|e2e`, defaults `NODE_ENV` to `test`, and supports `--coverage`.
- Register the TS/JSX loader with `remix/node-tsx` under `module`/`moduleResolution: NodeNext`, `allowImportingTsExtensions`, `isolatedModules`, `verbatimModuleSyntax`, `rewriteRelativeImportExtensions`. `mock.method` cannot spy frozen ES-module named exports; wrap the export in a mutable object.
- `npm run hmr` spawns `server.ts` behind a readiness-gated loopback proxy. Gate `fingerprint`/`minify` to non-dev, use `hmr({ channel, moduleImporter: 'remix/multiple-import-maps-polyfill' })` with `componentHmr()` in `scripts.loaders`, pin `HOST: '127.0.0.1'`, wrap `runner.ready()` in a timeout, exit on IPC `disconnect`, and set `trustProxy: isHmr`. Browser HMR is an EventSource on `HMR_PORT`, so CSP `connect-src` must allow it only when `REMIX_NODE_HMR === '1'`. `componentHmr` rewrites nested-function references to later setup declarations since #12290; only immediate setup code must declare before use.
- Self-host fonts: one woff2 per family, `font-weight: 100 900`, serve `public/` after `securityHeaders()`/`csp()`, link `/fonts/fonts.css`, keep `font-src 'self'`, and guard that home HTML has no font CDN.
- **Reproduce a post-bump failure on the previous pin first** before reading source. For a preview pin, read the resolved build from `pnpm-lock.yaml`, `git log`/`git diff --stat` the package, grep the codebase for each changed API, then run typecheck + tests. Focus on new opaque types, changed defaults, and new runtime validation. Prefer a new vendor built-in over an app-owned workaround, but audit the gaps and keep one integration e2e.
- **Guide audits:** diff the chapter between the previously pinned and current installs first; no diff means app-side drift. Verify each claim in code, probe streaming order with a throwaway router test, re-pin line anchors, record fixes in `docs/guide-skill-coverage.md`, and run the affected suites.

**Bun**

- `server.bun.ts` reuses `server.ts`'s router/DB bootstrap through one `createServerHandler(router)`; the only Bun-specific part is `runtime.requestIP(request)?.address`. Bun auto-loads `.env`.
- `"test:bun": "NODE_ENV=test bun node_modules/remix/dist/cli-entry.js test"` — plain `bun run remix test` runs Node through the pnpm shim. `@remix-run/test` is Bun-aware and skips coverage.
- `handle.signal` is a frozen plain object during SSR, not an `AbortSignal`; Bun throws `TypeError: Type error` on `{ signal: handle.signal }`. Register browser-only setup in `handle.queueTask`; keep `typeof document` only for render-time DOM reads.
- Bun's `File.type` appends `;charset=utf-8`; normalize through `ContentType.from(mime).mediaType?.toLowerCase()`.
- Never add `"bun"` to the main `tsconfig` `types` (Bun's `fetch` requires `preconnect`). Use `tsconfig.bun.json` with `files: ["server.bun.ts"]`. Bun's global `File` adds `image()`, so cast at `createFsFileStorage().set()`.
- `bun run <bin>` resolves through a `/bin/sh` shim ending in `exec node …`; force Bun with `bun --bun run <bin>`.

**Testing**

- Run one file with `NODE_ENV=test npx remix test app/ui/<name>.test.browser.tsx` (executes every configured project, here Chromium + Firefox).
- `render(...)` + `result.act(...)` flushes `handle.queueTask` and is enough for event-driven entries, but **not** when the side effect depends on geometry/media (`getBoundingClientRect`, `matchMedia`, `scrollTo`). Build a controlled fixture and stub with `t.mock.getter`/`t.mock.setter`/`t.mock.method` (auto-restored); pair every "not called" case with a positive case.
- Full-page entries render only a hidden marker and work through `document`/`window` in a `ref`: append the fixture to `document.body` (not `result.container`), assert against it, and remove it in `afterEach` even when an assertion throws (module-scoped delegated listeners persist; `cleanup()` does not remove them). Reset `location.hash`/`history.replaceState` in `beforeEach`.
- `RenderResult` does **not** expose the entry's `frame`; `reloadStart`/`reloadComplete` tests call the factory directly with a synthetic `Handle` (`frame: new EventTarget()`, real `signal`, `update` re-rendering into the test root, `queueTask` when a picker/dialog opens). Abort the signal + `cleanup()` in `afterEach`; keep an e2e for the real navigation.
- Ephemeral per-run DBs do **not** fix within-run interference: parallel workers' `setupTestEnvironment()` data accumulates in the shared DB, so a paginated test's own rows can fall off the first page. Diagnose by isolation, then keep `after()` cleanup, raise the test page size, or scope assertions to unique filters.
- A shared-DB test can fail **in isolation** when the fixture is not self-owned: `LIMIT 1` without `ORDER BY` picks an arbitrary row, and seed rows relative to today are excluded on weekends. Create the rows the assertion needs, require the properties in the query, and scope to identifiers the test owns.
- A `forks` pool isolates **processes, not the database**: scope every teardown delete to the ids/owner your suite created. A background timer started from shared init can delete the old row a test inserted — gate it with `process.env.NODE_ENV !== 'test'`.
- An existence-check `waitFor` passes instantly once the element is **statically present**; make the predicate overlap the assertion (wait on `textContent` if you assert on it).
- Mock external HTTP on **port 0** (OS-assigned) and read the URL through a **function** at request time (a module-level `const` is evaluated before `before()` can override it). Set `process.env.EXTERNAL_URL` from `mockServer.address()`, delete it in `after()`, and verify the forward via a side effect.
- Rendered HTML serializes `&` as `&amp;` (and `"` as `&quot;`), so string assertions must match the escaped form; prefer asserting on a redirect `Location` header.
- HTML content-model validation: use `html-validate` with `.htmlvalidate.json` `"extends": []`, `new HtmlValidate(new FileSystemConfigLoader())`, and the **async** `validateString`. Strip frame `<head>` blocks before validating; assert the response contains `<html`.
- The app seams: `createNewappRouter(options)` in `app/router.ts` (not `createAppRouter`), shared tests import `router` from `app/test-router.ts`, DB state is an ephemeral Postgres DB created by `test/setup.ts` via `remix.json` `test.setup`, and session/cookie helpers live in `test/utils.ts`. `npm test` is a three-leg chain; use `test:server|browser|e2e` (and `test:coverage`).
- E2E uses `t.serve(await createTestServer((request) => router.fetch(request)))` (arrow adapter) and creates the server inside each test because `t.serve` closes it; DB/file fixtures created outside need their own cleanup; scope Firefox-broken assertions with `isFirefox(page)`.
- **Native `<select>` change events are unreliable**: `selectOption` fires the remix `on('change')` handler in Chromium only; synthetic `change` does not reach selects even in Chromium. Retry through the hydration gap and scope Firefox out with a smoke check.
- Pre-hydration text/checkbox/radio edits are replayed (#12294), so do not add type-settle/retype loops. If a typed value still fails a DB assertion, attribute the flake to the baseline first (`git worktree add … HEAD~n` + symlinked `node_modules` + copied `.env`, run the file 3×).
- **Never use `networkidle`** on a page/action with SSE/streaming. Wait on a state-specific DOM anchor; use `waitForURL` for a signed-in submit→redirect; a short `waitForTimeout` only if an entry effect must settle.
- `window.location.reload`/`location` are unforgeable in real Chromium, and any `Location` navigation while an `await` is pending hangs the runner (`0/N files completed`). Window-mode navigation is not assertable: skip it, add an injectable reload seam, assert a pre-reload effect, or extract a pure predicate. `frame.reload()` is fine.
- Crash cards swallow the stack: wrap the throwing DOM method in `page.addInitScript` and stash the stack on `window` (or `sessionStorage` when navigating). DOMException messages are browser-specific.
- A `*.test.browser.tsx` cannot reproduce pointer modality: `.click()` never sets `:hover`, and `.focus()` keeps the last input modality. Drive the pointer path in e2e with `kebab.hover()` → `action.hover()` → `click()`; switch to keyboard modality before `.focus()`/`Enter` and assert `:focus-visible`. Count revealed instances with `getComputedStyle(cluster).opacity > 0.5`, and use `elementFromPoint(...).closest('[data-item-id]')` to prove the row under the pointer.
- **Never verify a destructive control against the running dev server.** It shares the persistent `DATABASE_URL`; prove behavior non-destructively or move it into a seeded e2e that deletes only its own rows.

### When to Use

- Wiring/diagnosing the asset server, moving browser source, running the `remix` CLI, or setting up `node-tsx`.
- HMR proxy hangs/`EADDRINUSE`/orphaned children, self-hosted fonts, or a font-CDN/CSP audit.
- A preview-pinned dependency moved; judging an update; auditing the app against a guide chapter.
- Running the app/tests under Bun, or a Node-vs-Bun divergence.
- Writing/debugging a server, browser, or e2e test: isolation, fixtures, mocks, escaped HTML, content-model validation, or Playwright hangs.
- A hover/focus control behaves differently with a real pointer, or a reorder pins/loses focus.

---

## Related

- vendor `remix` skill (`.opencode/skills/remix/SKILL.md`) — canonical framework guides, controllers, frames, rendering, assets, CLI, and testing APIs these deltas build on
- `mastra-deltas` — Mastra agents/tools/workflows and the Remix routing seams (SSE, approval gates, agent forms)
- `dev-gotchas` — TypeScript/JS patterns and the tooling gotchas these sections point at
- `agent-ops` — checkpoint handoffs and OpenSpec pre-sync
