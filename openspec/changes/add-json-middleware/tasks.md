## 1. Create `app/middleware/json-body.ts`

- [x] 1.1 Import `createContextKey`, `type Middleware` from `remix/router`
- [x] 1.2 Create `JsonBody = createContextKey<unknown>()` — the context key for parsed JSON body
- [x] 1.3 Define a `jsonBody(options?)` factory with:
  - `options.requireContentType` (default: `true`) — if true, reject non-JSON Content-Type
  - `options.maxSize` (default: `undefined`) — max Content-Length in bytes
- [x] 1.4 Inside the middleware, guard: if `requireContentType` is true and `Content-Type` header exists and doesn't include `application/json`, return `Response.json({ error: "Expected application/json" }, { status: 400 })`
- [x] 1.5 Check `Content-Length` against `maxSize` if set — return `Response.json({ error: "Payload too large" }, { status: 413 })` if exceeded
- [x] 1.6 Try `await request.json()`, catch `SyntaxError` — return `Response.json({ error: "Invalid JSON body" }, { status: 400 })` on failure
- [x] 1.7 Store parsed body: `context.set(JsonBody, body, { property: 'jsonBody' })` then `return next()`
- [x] 1.8 Export `jsonBody` and `JsonBody` as named exports

## 2. Wire into middleware stack

- [x] 2.1 Import `jsonBody` from `./json-body.ts` in `app/middleware/root.ts`
- [x] 2.2 Insert `jsonBody()` into the `createMiddleware()` chain after `formData()` and `methodOverride()`, before `session()` — fast body parsing, available to downstream middleware

## 3. Refactor existing controllers to use `context.jsonBody`

- [x] 3.1 `app/actions/webhook/controller.tsx` — import `JsonBody`, replace try/catch with `context.get(JsonBody)`, remove Content-Type and Content-Length manual checks
- [x] 3.2 `app/actions/app-webhook/controller.tsx` — same refactor
- [x] 3.3 `app/actions/callback/controller.tsx` — same refactor
- [x] 3.4 `app/actions/lists/controller.tsx` — replace try/catch blocks (2 occurrences, lines 38-44 and ~90)
- [x] 3.5 `app/actions/nutzer/controller.tsx` — replace try/catch blocks (2 occurrences)
- [x] 3.6 `app/actions/appointment/controller.tsx` — replace try/catch blocks (4 occurrences)
- [x] 3.7 `app/actions/client/controller.tsx` — replace try/catch block (1 occurrence, line 155)

## 4. Verify

- [x] 4.1 Run `npm run typecheck` — verify no type errors
- [x] 4.2 Run `npm test` — confirm all existing tests still pass
- [x] 4.3 Spot-check a JSON endpoint manually — start dev server, POST valid JSON and invalid JSON, verify 400/200 responses
