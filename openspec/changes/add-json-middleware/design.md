## Context

The app serves JSON endpoints across auth (password reset, token verify), appointments (drag-drop, inline edit), lists (save/update), webhooks (receive), and admin controllers (nutzer CRUD, client updates). Every JSON endpoint manually calls `await request.json()` in a try/catch, checks content type and size ad-hoc, and returns its own error shape.

The `formData()` middleware already provides the pattern we need — parse the body once, store in context, let handlers read cleanly:

```
formData()  ──►  context.formData  ──►  handler uses context.formData
jsonBody()  ──►  context.jsonBody  ──►  handler uses context.jsonBody
```

The existing `json()` render middleware (for responses) at `app/middleware/json-render.ts` is a separate concern — it provides `context.json()` for responses. The new middleware is for request body parsing. They coexist under different property names.

## Goals / Non-Goals

**Goals:**
- Parse JSON request bodies once per request in middleware, before they reach handlers
- Surface parsed body as `context.jsonBody` (typed as `unknown`, same as `request.json()`)
- Return consistent `400` with `{ error: "Invalid JSON body" }` on parse failure
- Support optional `maxSize` limit, returning `413` with `{ error: "Payload too large" }`
- Support optional `requireContentType` option (default `true`) to reject non-JSON Content-Type
- Replace the 12+ hand-rolled `request.json()` call sites
- Match the existing middleware conventions: `createContextKey`, `context.set(Key, ...)`

**Non-Goals:**
- Schema validation — the middleware only guarantees the body is valid JSON. Schema validation (vs `data-schema`) stays in handlers where `data-schema` already handles it
- Content negotiation (Accept header) — that's a separate concern for response shaping
- Modifying request body after parsing — the parsed value is read-only
- Streaming/large body handling — the middleware reads the full body into memory (same as `request.json()`)

## Decisions

1. **Context key + property** — follow the `json-render.ts` pattern exactly. Export `JsonBody = createContextKey<unknown>()` and set it with `property: 'jsonBody'` so controllers use `context.jsonBody`.

2. **Error envelope** — `{ error: "Invalid JSON body" }` for 400, `{ error: "Payload too large" }` for 413. This matches the most common format already used by the existing controllers (e.g., `lists/controller.tsx` returns `{ error: "Invalid JSON body" }`).

3. **requireContentType: true by default** — if the request has a Content-Type header that isn't `application/json`, return 400. This catches a common class of misconfigured clients early. Pass `false` to allow any Content-Type (useful for routes that accept multiple formats or have no Content-Type at all, like raw webhook payloads).

4. **maxSize based on Content-Length** — if the `Content-Length` header exceeds `maxSize`, reject before reading the body. This avoids streaming a large payload just to reject it. Default: no limit (matching current behavior).

5. **Stack position** — insert `jsonBody()` after `formData()` and `methodOverride()`, before `session()`. This makes parsed JSON body available to session-loading logic or auth middleware if they need it, while keeping it after body parsing middleware (`formData()` already consumed the stream for multipart).

6. **Middleware is opt-in per action** — unlike `formData()` which runs globally, controllers that don't need JSON won't see overhead. But registering it globally is also harmless (it's a fast `Content-Type` check for non-JSON requests).

## Risks / Trade-offs

- **Body stream consumed once** — if a controller calls `jsonBody()` middleware AND then tries `await request.json()`, the second call throws or hangs. This is the same constraint as `formData()`. Handlers must use `context.jsonBody` after middleware has run.
- **Memory** — the parsed body is kept in context for the full request lifetime. For large payloads this adds memory pressure, but no worse than calling `request.json()` in the handler today.
- **No streaming alternative** — if we ever need streaming JSON parsing (e.g., NDJSON), this middleware won't support it. That would need a separate middleware or explicit handler code.
