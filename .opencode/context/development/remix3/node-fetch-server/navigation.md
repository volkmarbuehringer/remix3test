<!-- Context: development/remix3/node-fetch-server | Priority: high | Version: 1.0 | Updated: 2026-05-20 -->

# Node Fetch Server (@remix-run/node-fetch-server)

**Core Idea**: Build Node.js servers with web-standard Fetch API primitives. Converts Node's `http.ServerResponse`/`IncomingMessage` interfaces into `Request`/`Response` flows.

## Quick Routes

| Task | File |
|------|------|
| `createRequestListener`, handler arity, dispatch flow | `concepts/server-architecture.md` |
| `createRequest`, `sendResponse`, `createHeaders` | `concepts/request-response.md` |
| `LazyRequest` — deferred body materialization | `concepts/lazy-request.md` |
| `FetchHandler`, `ClientAddress`, `ErrorHandler` types | `concepts/handler-types.md` |
| Basic HTTP server, HTTPS, streaming, client info | `guides/quick-start.md` |
| Low-level `createRequest` + `sendResponse` for custom middleware | `guides/low-level-api.md` |
| `createTestServer` from `remix/node-fetch-server/test` | `guides/testing.md` |
| `host`, `protocol`, `onError` options reference | `lookup/options.md` |

## Source

- Package source: `~/remix/packages/node-fetch-server/`
- Core: `src/lib/request-listener.ts` — `createRequestListener`, `createRequest`, `sendResponse`, `createHeaders`
- Lazy: `src/lib/lazy-request.ts` — `LazyRequest`, `BoundLazyRequest`
- Types: `src/lib/fetch-handler.ts` — `FetchHandler`, `ClientAddress`, `ErrorHandler`
- Testing: `src/lib/test-server.ts` — `createTestServer`, `TestServer`

## Related

- `../server/guides/node-fetch-server-setup.md` — Existing setup guide
- `../fetch-router/navigation.md` — Fetch router (works on top of this)
