# Request Middleware and the Server Boundary

**Source:** Installed guide `node_modules/remix/guides/03-request-handling.md` — Web request/response contract (§"The Web Request/Response contract"), `createRequestListener` options (§"createRequestListener"), middleware ordering and scopes (§"Middleware ordering"), typed context and `RouterContext` (§"Typed request context"), common middleware table (§"Common middleware: form-data, render, static files, compression, logging, method override"). Cross-checked against the installed READMEs `node_modules/remix/src/node-fetch-server/README.md`, `node_modules/remix/src/compression-middleware/README.md`, and `node_modules/remix/src/logger-middleware/README.md`.

**Extracted:** 2026-09-26

**Context:** Changing the Node/Bun server entry, the root middleware chain (`app/middleware/root.ts`), or anything that reads `request.body` / `request.signal` or the typed `AppContext`.

## Problem

Guide 03 describes the portable path and the middleware contract, but this app assembles its own root chain in `app/middleware/root.ts` and its own boundary behavior in `server.ts`, `server.bun.ts`, and `app/utils/server-handler.ts`. Error handling has moved to `createRequestListener({ onError })`, and the app derives `AppContext` from a stored chain rather than the guide's inline `RouterContext<typeof router>`. This reference records those seams and the ordering rules the app depends on.

## Solution

### `createRequestListener` options: `host`, `protocol`, `onError`

- Guide §"createRequestListener". `host` and `protocol` pin the values used to build `request.url`; `trustProxy` trusts `Forwarded`/`X-Forwarded-*` (covered by `security-gotchas`); `onError(error)` logs and may return the response sent instead of the default `500`. When `host` or `protocol` is set, it takes precedence over trusted proxy headers (`node_modules/remix/src/node-fetch-server/README.md`).
- App seam: `server.ts:30` calls `createRequestListener((request, client) => handleRequest(request, client.address), { trustProxy: isHmr })`. It does not pass `host`/`protocol`/`onError`. The app owns the error response instead: `createServerHandler(...)` in `app/utils/server-handler.ts` wraps `router.fetch` in try/catch, logs, and returns the app HTML 500 page. Because that catch never lets a router error escape to the listener, adding `onError` to `createRequestListener` would be dead for router errors; keep error centralization in `createServerHandler` unless you deliberately move it to the boundary. `trustProxy` is `true` only for the HMR dev proxy, never in production. (app re-checked 2026-10-14: `server.ts` now also passes `onError`, which logs and returns `renderServerError()` from `app/utils/server-handler.ts`; `createServerHandler` no longer wraps `router.fetch` in try/catch, so the 'does not pass `onError`' and 'owns the error response instead' statements above are obsolete. `server.bun.ts` still catches the rejection itself.)

### The `(request, client)` second argument and the low-level exports

- Guide §"createRequestListener". The handler receives `client: ClientAddress` with `address`, `family` (`IPv4` | `IPv6`), and `port` (installed `node-fetch-server/src/lib/fetch-handler.ts`).
- App seam: `server.ts` imports `type ClientAddress` and uses only `client.address`; `createServerHandler` stamps it as `X-Client-Ip` before `router.fetch` (`app/utils/server-handler.ts`), which `app/utils/request-ip.ts` (`connectionIp`, `sourceIp`) and the rate limiter read. `server.bun.ts` mirrors the same contract from Bun's `runtime.requestIP(request)?.address` because it never goes through `createRequestListener`. If you add client-address-dependent middleware, consume `X-Client-Ip` (the boundary already set it) rather than re-deriving it from arbitrary headers.
- The same package also exports the low-level `createRequest(req, res, options)` and `sendResponse(res, response)` (node-fetch-server README, "Low-level API"). This app has no caller (grep `createRequest(`/`sendResponse(` is empty) and no reason to add one: `createRequestListener` already covers the flow, and the app needs the URL construction and error behavior that live in `createServerHandler`.

### `compression()`: negotiation, guards, and the before-`staticFiles()` rule

- Guide §"Middleware ordering" and §"Common middleware: form-data, render, static files, compression, logging, method override" state the ordering rule: a response wrapper must run before the early response it should wrap, so `compression()` must precede `staticFiles()`. The middleware negotiates `br`, `gzip`, `deflate` from `Accept-Encoding` and skips already-compressed responses, responses that advertise range support (`Accept-Ranges: bytes`), non-compressible MIME types, and bodies below the threshold (default 1024 bytes, enforced only when `Content-Length` is present) — see `node_modules/remix/src/compression-middleware/README.md`.
- App seam: the root chain follows the guide — `securityHeaders()` → `compression()` → `staticFiles('./public', { index: false, cacheControl: … })` (`app/middleware/root.ts:57-71`). Consequences: static responses are wrapped by `securityHeaders()` and `compression()`; `.woff2` files are skipped by the already-compressed MIME guard while `fonts.css` is compressed. Requests that reach actions are also wrapped, because `compression()` sits before the session/database/render stack. Keep `compression()` above `staticFiles()` if you add large static text. The app uses the default compression options.

### `logger()` and `context.logger(...)`

- Guide §"Common middleware: form-data, render, static files, compression, logging, method override": `logger()` logs the request and downstream response and provides `context.logger(...)`; put it first so early responses and `404`s are logged. The logger README documents the token `format` option, `colors`, a custom `log`, and `context.get(Logger)`.
- App seam: the app does not use a bare `logger()` first. `app/middleware/root.ts:34-52` defines `skipAssetsLogger()`, a `Middleware<{ key: typeof Logger; value: LoggerFunction; property: 'logger' }>` that delegates to `logger({ format: '[%date] %method %path → %status (%duration)' })` for non-asset paths, and for `/assets/` installs `context.set(Logger, console.log, { property: 'logger' })` and only logs responses with status >= 400. It is first in the chain (`app/middleware/root.ts:56`), so the log-early-responses rule holds.
- `context.logger?.(...)` is this app's standard failure logging in controllers (about twenty calls, e.g. `app/actions/lists/controller.tsx:234`, `app/actions/auth/controller.tsx:287`). Use the optional call in controllers rather than `console.error` so the configured format is reused; the property comes from the logger middleware installed by `skipAssetsLogger()`.

### Middleware scopes and ordering rules

- Guide §"Middleware ordering". Three scopes: router middleware (before route matching, every request), controller middleware (direct actions of one controller), and action middleware (one action); the full order is router, then controller, then action, then handler. Choose order by dependency and wrapping: provider before consumer, response-wrapper before the early response it wraps, work after a fast path that does not need it.
- App chain: `createNewappMiddleware(cookie, storage)` in `app/middleware/root.ts:54-102` is the single router middleware tuple, built with `createMiddleware(...)` so its type survives. Order-dependent pairs the app relies on:
  - `securityHeaders()` before `compression()` and `staticFiles()` so static responses still carry the CSP (`:57`–`:71`).
  - `session(cookie, storage)` before `asyncContext()`, `loadDatabase()`, `loadAuth()`, and `skipCsrf()` (`:79`–`:88`).
  - `loadDatabase()` before `loadAuth()` (`:81` vs `:82`); `loadAuth` calls `context.get(databaseContext)` and throws `Expected database middleware before session auth scheme` if the DB was not set first (`app/middleware/auth.ts`).
  - `uploadClaimScope()` before `uploadFormData()` (`:84` vs `:85`), and `uploadFormData()` before `methodOverride()` (`:86`), matching guide §"Common middleware: form-data, render, static files, compression, logging, method override".
  - `methodOverride()` before `jsonBody()` and `skipCsrf()`; `skipCsrf()` must stay after `uploadFormData()` because `csrf()` reads the token from `context.get(FormData)`. The upload middleware itself performs pre-parse 401/403 checks because auth and request context now run earlier (`:79`–`:85`).
  - `asyncContext()` before any middleware that reads ambient context (`getContext()`), including `loadAuth`/`uploadFormData`.
  - `loadAssetEntry()` after CSRF and before `render({ assets: assetServer })`; `render` follows middleware that may answer without rendering (`:89` vs `:94`).
- Controller- and action-scope details are in `references/route-contract-and-controllers.md`: `createController(..., { middleware })` merges only into direct leaves, and the per-action object form is `{ middleware, handler }`.

### `RouterContext<typeof router>` vs this app's `MiddlewareContext` factory

- Guide §"Typed request context" shows `type AppContext = RouterContext<typeof router>` followed by `declare module "remix" { interface RouterTypes { context: AppContext } }`, which works when the middleware chain is an inline array on the `createRouter(...)` call. The same section splits the cases: inline arrays use `RouterContext`; a reusable or stored chain uses `createMiddleware(...)` plus `MiddlewareContext<typeof middleware>` (also `node_modules/remix/src/fetch-router/README.md` §"Typed Context Contracts").
- App seam: this app stores the chain in a factory, so `AppContext = MiddlewareContext<ReturnType<typeof createNewappMiddleware>>` (`app/types/context.ts`), and `app/router.ts` still performs the module augmentation (`declare module 'remix' { interface RouterTypes { context: AppContext } }`). Do not simplify to `RouterContext<typeof router>` without inlining the whole chain: the factory split is what keeps `app/types/context.ts` from importing `router.ts` and closing the `router.ts → controllers → context.ts → router.ts` cycle documented in `references/context-keys-and-dependency-flow.md`. Apps with multiple routers should pass explicit context types instead of the app-wide default (guide §"Typed request context"); this app has one router factory and relies on the global augmentation.

### `request.body` / `ReadableStream` and `request.signal`

- Guide §"The Web Request/Response contract": bodies stay Web streams, actions can read `request.body`, return a `Response` backed by a `ReadableStream`, and observe cancellation through `request.signal`.
- App seams:
  - Stream body with a cap: `app/middleware/json-body.ts` reads `context.request.body?.getReader()`, accumulates chunks, and calls `reader.cancel()` when the byte cap would be exceeded (chunked or unknown-length requests); it uses `Content-Length`/`Transfer-Encoding` to choose the cheap path.
  - Cancellation: `app/utils/sse.ts:136` registers `request.signal.addEventListener('abort', ...)` to drop the subscriber and close the stream when the client disconnects; `app/actions/agent-events/controller.tsx:254` checks `context.request.signal.aborted` inside a stream loop; `app/middleware/frame-redirect.ts:66-70` forwards `signal: context.request.signal` into the internal `context.router.fetch`.
  - Use `context.request.signal` (the original request), not a fresh `AbortController`, for disconnect-driven cleanup. An abort during a handler surfaces as a `router.fetch` rejection whose reason is the signal reason; `app/utils/server-handler.ts` deliberately suppresses logging for exactly `request.signal.aborted && error === request.signal.reason` while still returning the 500 page for other errors. (app re-checked 2026-10-14: that suppression no longer lives in `server-handler.ts`; it is in `server.bun.ts`'s `fetch` catch, and `server.ts` logs every `onError`.)

## When to Use

- Editing `server.ts`, `server.bun.ts`, or `app/utils/server-handler.ts`: host/protocol, the `(request, client)` client address, or where the 500 response is produced.
- Changing the root middleware order in `app/middleware/root.ts`, especially `compression()` vs `staticFiles()`, or adding a provider/consumer pair.
- Reading `context.logger` in a controller, or wiring and altering the logger.
- Deriving or augmenting `AppContext` and deciding between `RouterContext` and `MiddlewareContext`.
- Handling a streaming response or client disconnects through `request.body` / `request.signal`.

## Reference

- `app/middleware/root.ts` — root chain; `app/types/context.ts` — `AppContext`; `app/router.ts` — module augmentation.
- `server.ts`, `server.bun.ts`, `app/utils/server-handler.ts`, `app/utils/request-ip.ts` — runtime boundary and client IP.
- Installed vendor docs: `node_modules/remix/src/node-fetch-server/README.md`, `node_modules/remix/src/compression-middleware/README.md`, `node_modules/remix/src/logger-middleware/README.md`; source types `node_modules/.pnpm/@remix-run+node-fetch-server@*/node_modules/@remix-run/node-fetch-server/src/lib/fetch-handler.ts`.
