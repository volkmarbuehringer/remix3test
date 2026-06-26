## Why

The app handles JSON request bodies in 12+ controller actions, yet every one repeats the same try/catch boilerplate and invents its own error format. There is no middleware to parse JSON bodies, mirroring how `formData()` middleware handles form submissions:

```
Current pattern (repeated 12×):
  handler() {
    let body: unknown
    try {
      body = await context.request.json()
    } catch {
      return context.json({ error: 'Invalid JSON' }, { status: 400 })
    }
    // ... validate and process
  }

What middleware enables:
  // body parsed once, errors handled centrally
```

This is a concrete DRY violation — 12 copies of ~5 lines each that differ slightly in error format, content-type checking, and size limiting. Beyond duplication, the manual pattern means:

- **Middleware can't see JSON bodies** — auth middleware, logging, or request validation can't inspect or act on parsed JSON payloads before they reach handlers
- **Inconsistent error responses** — each action returns a slightly different shape for "bad JSON"
- **No size enforcement at the boundary** — every action that reads JSON must remember to check `Content-Length`
- **Breaks the abstraction** — `formData()` flows through the context system; JSON bodies bypass it

## What Changes

- Create `app/middleware/json-body.ts` — a `jsonBody()` middleware factory that:
  - Checks `Content-Type` is `application/json` (configurable, on by default)
  - Reads the body stream once, parses as JSON
  - Returns `400` with a standard error envelope on parse failure
  - Stores the parsed result as `context.jsonBody` (via `context.set(JsonBody, ...)`)
  - Supports a `maxSize` option (bytes), returning `413` when exceeded
  - Exposes a `JsonBody` context key for `context.get(JsonBody)` usage
- Register it in the middleware stack in `app/middleware/root.ts` — after `formData()` and `methodOverride()`, before `session()`
- Refactor the 12+ controllers that call `await request.json()` to read from `context.jsonBody` instead

## Capabilities

No new user-facing capability. Internal architecture improvement that applies to all JSON-consuming routes across auth, appointments, lists, and webhook controllers.

## Impact

- `app/middleware/json-body.ts` — new file (~45 lines)
- `app/middleware/root.ts` — add one import and one line to the middleware chain
- 12+ controller files — replace try/catch parse blocks with `context.jsonBody` reads (smaller diffs, net lines removed)
