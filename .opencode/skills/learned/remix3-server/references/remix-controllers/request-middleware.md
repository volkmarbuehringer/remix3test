# Request Middleware and the Server Boundary

**Source:** Installed guide `node_modules/remix/guides/03-request-handling.md` — Web request/response contract (§"The Web Request/Response contract"), `createRequestListener` options (§"createRequestListener"), middleware ordering and scopes (§"Middleware ordering"), typed context and `RouterContext` (§"Typed request context"), common middleware table (§"Common middleware: form-data, render, static files, compression, logging, method override"). Cross-checked against the installed READMEs `node_modules/remix/src/node-fetch-server/README.md`, `node_modules/remix/src/compression-middleware/README.md`, and `node_modules/remix/src/logger-middleware/README.md`.

**Extracted:** 2026-09-26

**Re-validated (2026-11-11):** against preview release `v0.20261112.185417-main-72a7ad0f` / source `72a7ad0f` (`remix` `3.2.0` / `@remix-run/fetch-router` + `@remix-run/node-fetch-server` as installed). #12190 adds the abandoned-response-body cancel (`fetch-router/src/lib/request-abort.ts`) and the HEAD body strip; the cancellation anchors below were added in the same pass.

**Context:** Changing the Node/Bun server entry, the root middleware chain (`app/middleware/root.ts`), or anything that reads `request.body` / `request.signal` or the typed `AppContext`.

## Problem

Guide 03 describes the portable path and the middleware contract, but this app assembles its own root chain in `app/middleware/root.ts` and its own boundary behavior in `server.ts`, `server.bun.ts`, and `app/utils/server-handler.ts`. Error handling has moved to `createRequestListener({ onError })`, and the app derives `AppContext` from a stored chain rather than the guide's inline `RouterContext<typeof router>`. This reference records those seams and the ordering rules the app depends on.

## Solution

### `createRequestListener` options: `host`, `protocol`, `onError`

- Guide §"createRequestListener". `host` and `protocol` pin the values used to build `request.url`; `trustProxy` trusts `Forwarded`/`X-Forwarded-*` (covered by `security-gotchas`); `onError(error)` logs and may return the response sent instead of the default `500`. When `host` or `protocol` is set, it takes precedence over trusted proxy headers (`node_modules/remix/src/node-fetch-server/README.md`).
- App seam: `server.ts:33-42` calls `createRequestListener((request, client) => handleRequest(request, client.address), { trustProxy: isHmr, onError(error) { console.error(error); return renderServerError() } })`. `onError` is the Node boundary's 500 path; `createServerHandler` (`app/utils/server-handler.ts:92-100`) only stamps `X-Client-Ip` and calls `router.fetch` — it does **not** catch. `server.bun.ts` catches its own async rejection because it bypasses `createRequestListener`. `trustProxy` is `true` only for the HMR dev proxy, never in production.

### The `(request, client)` second argument and the low-level exports

- Guide §"createRequestListener". The handler receives `client: ClientAddress` with `address`, `family` (`IPv4` | `IPv6`), and `port` (installed `node-fetch-server/src/lib/fetch-handler.ts`).
- App seam: `server.ts` imports `type ClientAddress` and uses only `client.address`; `createServerHandler` stamps it as `X-Client-Ip` before `router.fetch` (`app/utils/server-handler.ts`), which `app/utils/request-ip.ts` (`connectionIp`, `sourceIp`) and the rate limiter read. `server.bun.ts` mirrors the same contract from Bun's `runtime.requestIP(request)?.address` because it never goes through `createRequestListener`. If you add client-address-dependent middleware, consume `X-Client-Ip` (the boundary already set it) rather than re-deriving it from arbitrary headers.
- The same package also exports the low-level `createRequest(req, res, options)` and `sendResponse(res, response)` (node-fetch-server README, "Low-level API"). This app has no caller (grep `createRequest(`/`sendResponse(` is empty) and no reason to add one: `createRequestListener` already covers the flow, and the app needs the URL construction and `onError` behavior that live in `server.ts`.

### `compression()`: negotiation, guards, and the before-`staticFiles()` rule

- Guide §"Middleware ordering" and §"Common middleware: form-data, render, static files, compression, logging, method override" state the ordering rule: a response wrapper must run before the early response it should wrap, so `compression()` must precede `staticFiles()`. The middleware negotiates `br`, `gzip`, `deflate` from `Accept-Encoding` and skips already-compressed responses, responses that advertise range support (`Accept-Ranges: bytes`), non-compressible MIME types, and bodies below the threshold (default 1024 bytes, enforced only when `Content-Length` is present) — see `node_modules/remix/src/compression-middleware/README.md`.
- App seam: the root chain follows the guide — `securityHeaders()` → `csp()` → `compression()` → `staticFiles('./public', { index: false, cacheControl: … })` (`app/middleware/root.ts:63-89`). The vendor `csp()` sits between them so static responses still get the policy/nonce; `securityHeaders()` owns the non-CSP hardening headers and cache policy. Consequences: static responses are wrapped by `securityHeaders()`, `csp()`, and `compression()`; `.woff2` files are skipped by the already-compressed MIME guard while `fonts.css` is compressed. Requests that reach actions are also wrapped, because `compression()` sits before the session/database/render stack. Keep `compression()` above `staticFiles()` if you add large static text. The app uses the default compression options.

### `logger()` and `context.logger(...)`

- Guide §"Common middleware: form-data, render, static files, compression, logging, method override": `logger()` logs the request and downstream response and provides `context.logger(...)`; put it first so early responses and `404`s are logged. The logger README documents the token `format` option, `colors`, a custom `log`, and `context.get(Logger)`.
- App seam: the app does not use a bare `logger()` first. `app/middleware/root.ts:40-58` defines `skipAssetsLogger()`, a `Middleware<{ key: typeof Logger; value: LoggerFunction; property: 'logger' }>` that delegates to `logger({ format: '[%date] %method %path → %status (%duration)' })` for non-asset paths, and for `/assets/` installs `context.set(Logger, console.log, { property: 'logger' })` and only logs responses with status >= 400. It is first in the chain (`app/middleware/root.ts:62`), so the log-early-responses rule holds.
- `context.logger?.(...)` is this app's standard failure logging in controllers (about twenty calls, e.g. `app/actions/lists/controller.tsx:234`, `app/actions/auth/controller.tsx:287`). Use the optional call in controllers rather than `console.error` so the configured format is reused; the property comes from the logger middleware installed by `skipAssetsLogger()`.

### Middleware scopes and ordering rules

- Guide §"Middleware ordering". Three scopes: router middleware (before route matching, every request), controller middleware (direct actions of one controller), and action middleware (one action); the full order is router, then controller, then action, then handler. Choose order by dependency and wrapping: provider before consumer, response-wrapper before the early response it wraps, work after a fast path that does not need it.
- App chain: `createNewappMiddleware(cookie, storage)` in `app/middleware/root.ts:60-130` is the single router middleware tuple, built with `createMiddleware(...)` so its type survives. Order-dependent pairs the app relies on:
  - `securityHeaders()` before `csp()`, `compression()`, and `staticFiles()` so static responses still carry the hardening headers and the CSP (`:63`–`:89`). `csp()` must come after `securityHeaders()` (it owns the nonce/policy) and before `compression()`/`staticFiles()` so those responses are stamped.
  - `session(cookie, storage)` before `asyncContext()`, `loadDatabase()`, `loadAuth()`, and `skipCsrf()` (`:104`–`:117`).
  - `loadDatabase()` before `loadAuth()` (`:106` vs `:107`); `loadAuth` calls `context.get(databaseContext)` and throws `Expected database middleware before session auth scheme` if the DB was not set first (`app/middleware/auth.ts`).
  - `uploadClaimScope()`/`uploadFilesScope()` before `uploadFormData()` (`:109`/`:113` vs `:114`), and `uploadFormData()` before `methodOverride()` (`:115`), matching guide §"Common middleware: form-data, render, static files, compression, logging, method override".
  - `methodOverride()` before `jsonBody()` and `skipCsrf()`; `skipCsrf()` must stay after `uploadFormData()` because `csrf()` reads the token from `context.get(FormData)`. The upload middleware itself performs pre-parse 401/403 checks because auth and request context now run earlier (`:104`–`:114`).
  - `asyncContext()` before any middleware that reads ambient context (`getContext()`), including `loadAuth`/`uploadFormData`.
  - `loadAssetEntry()` after CSRF and before `render({ assets: assetServer })`; `render` follows middleware that may answer without rendering (`:118` vs `:123`).
- Controller- and action-scope details are in `references/route-contract-and-controllers.md`: `createController(..., { middleware })` merges only into direct leaves, and the per-action object form is `{ middleware, handler }`.

### `RouterContext<typeof router>` vs this app's `MiddlewareContext` factory

- Guide §"Typed request context" shows `type AppContext = RouterContext<typeof router>` followed by `declare module "remix" { interface RouterTypes { context: AppContext } }`, which works when the middleware chain is an inline array on the `createRouter(...)` call. The same section splits the cases: inline arrays use `RouterContext`; a reusable or stored chain uses `createMiddleware(...)` plus `MiddlewareContext<typeof middleware>` (also `node_modules/remix/src/fetch-router/README.md` §"Typed Context Contracts").
- App seam: this app stores the chain in a factory, so `AppContext = MiddlewareContext<ReturnType<typeof createNewappMiddleware>>` (`app/types/context.ts`), and `app/router.ts` still performs the module augmentation (`declare module 'remix' { interface RouterTypes { context: AppContext } }`). Do not simplify to `RouterContext<typeof router>` without inlining the whole chain: the factory split is what keeps `app/types/context.ts` from importing `router.ts` and closing the `router.ts → controllers → context.ts → router.ts` cycle documented in `references/context-keys-and-dependency-flow.md`. Apps with multiple routers should pass explicit context types instead of the app-wide default (guide §"Typed request context"); this app has one router factory and relies on the global augmentation.

### `request.body` / `ReadableStream` and `request.signal`

- Guide §"The Web Request/Response contract": bodies stay Web streams, actions can read `request.body`, return a `Response` backed by a `ReadableStream`, and observe cancellation through `request.signal`.
- App seams:
  - Stream body with a cap: `app/middleware/json-body.ts` reads `context.request.body?.getReader()`, accumulates chunks, and calls `reader.cancel()` when the byte cap would be exceeded (chunked or unknown-length requests); it uses `Content-Length`/`Transfer-Encoding` to choose the cheap path.
  - Cancellation: `app/utils/sse.ts:136` registers `request.signal.addEventListener('abort', ...)` to drop the subscriber and close the stream when the client disconnects; `app/actions/agent-events/controller.tsx:317` checks the stream scope's `signal.aborted` inside a stream loop; `app/middleware/frame-redirect.ts:94-107` forwards `signal: context.request.signal` into the internal `context.router.fetch`.
  - **A cancelled response body is a second cleanup path, not only an abort.** Since remix #12190 `remix/fetch-router` cancels the body of a response abandoned by an aborted request (`raceRequestAbort()` → `response.body?.cancel(reason)` in `fetch-router/src/lib/request-abort.ts:32-34`), and `createRequestListener` cancels the reader when the HTTP response closes (`reader.cancel()` in `node-fetch-server/src/lib/request-listener.ts:748-753`). A server `ReadableStream` needs an underlying `cancel()` hook for this: `createAbortScope()` (`app/utils/agent-sse.ts:80`) links the request signal to a stream-local controller whose `abort()`/`cleanup()` are idempotent, and `createRunSignal()` (`:121`) adds the whole-run timeout and the same `abort()`. The app wires it into every SSE source: `app/utils/sse.ts:146` (heartbeat + subscriber), `app/utils/agent-sse.ts:160` (`sseRunResponse()`, which all six chat streams in `app/utils/agent-chat.ts` and `app/utils/agent-chat-durable.ts` open through, so the hook cannot be forgotten — abort the agent run, clear the timeout/listener; a cancelled durable stream must not record an ownership row), and `app/actions/agent-events/controller.tsx:449,540` (abort the workflow/bus scope). `cancel()` must tolerate a racing abort: closing an already-cancelled controller throws (use `safeClose`) and a second `clearInterval`/`removeEventListener` must be harmless. Guards: `app/utils/sse.test.ts`, `app/utils/agent-sse.test.ts`, `app/utils/agent-chat-cancel.test.ts`, `app/actions/agent-events/controller.test.ts`.
  - Use `context.request.signal` (the original request), not a fresh `AbortController`, for disconnect-driven cleanup. An abort during a handler surfaces as a `router.fetch` rejection whose reason is the signal reason. `server.bun.ts`'s `fetch` catch suppresses logging for exactly `request.signal.aborted && error === request.signal.reason`; the Node entry logs every `onError`.

## When to Use

- Editing `server.ts`, `server.bun.ts`, or `app/utils/server-handler.ts`: host/protocol, the `(request, client)` client address, or where the 500 response is produced.
- Changing the root middleware order in `app/middleware/root.ts`, especially `compression()` vs `staticFiles()`, or adding a provider/consumer pair.
- Reading `context.logger` in a controller, or wiring and altering the logger.
- Deriving or augmenting `AppContext` and deciding between `RouterContext` and `MiddlewareContext`.
- Handling a streaming response or client disconnects through `request.body` / `request.signal`, or returning a server `ReadableStream` (SSE): add a `cancel()` hook that aborts the producer and clears timers/listeners, and prove it by cancelling the response body in a test (aborting the request alone does not exercise `cancel()`).

## Reference

- `app/middleware/root.ts` — root chain; `app/types/context.ts` — `AppContext`; `app/router.ts` — module augmentation.
- `server.ts`, `server.bun.ts`, `app/utils/server-handler.ts`, `app/utils/request-ip.ts` — runtime boundary and client IP.
- Installed vendor docs: `node_modules/remix/src/node-fetch-server/README.md`, `node_modules/remix/src/compression-middleware/README.md`, `node_modules/remix/src/logger-middleware/README.md`; source types `node_modules/.pnpm/@remix-run+node-fetch-server@*/node_modules/@remix-run/node-fetch-server/src/lib/fetch-handler.ts`.
