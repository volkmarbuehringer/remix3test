---
name: remix-security-middleware
description: Protect Remix apps with CSRF tokens, CORS policies, and cross-origin protection. Activate when adding security middleware to your router stack.
---

# Remix Security Middleware

Covers `remix/middleware/csrf`, `remix/middleware/cors`, `remix/middleware/cop`.

## CSRF Protection

Session-backed synchronizer token validation:

```ts
import { csrf, getCsrfToken } from 'remix/middleware/csrf'

let router = createRouter({
  middleware: [session(cookie, storage), csrf()],
})
```

Token sources (by default): `X-Csrf-Token` header > `_csrf` form field > `_csrf` query param. Requires `session-middleware` to run first.

### Common Pitfall: Every POST Form Needs a CSRF Token Input

When `csrf()` is installed globally, every non-GET request is validated. A `<form method="POST">` without a hidden `_csrf` field will get a **403 Forbidden** with "missing csrf token" in the server log.

Add `<CsrfTokenInput />` inside every `<form method="POST">`:

```tsx
import { CsrfTokenInput } from './csrf-token-input.tsx'

;<form method="POST" action={routes.someRoute.index.href()}>
  <CsrfTokenInput />
  <button type="submit">Submit</button>
</form>
```

`CsrfTokenInput` renders `<input type="hidden" name="_csrf" value="<token>" />` during SSR by reading the CSRF token from async request context.

### Skipping CSRF for External Endpoints (Webhooks)

When `csrf()` is installed globally, external callers (webhooks, API integrations) cannot provide a CSRF token. Wrap the `csrf()` middleware in a path-checking conditional:

```tsx
// app/middleware/skip-csrf.ts
import type { Middleware } from 'remix/router'
import { csrf } from 'remix/middleware/csrf'

const csrfMiddleware = csrf({
  origin: (origin, context) =>
    /\.trusteddomain\.com$/.test(origin) || origin === context.url.origin,
})

export function skipCsrf(): Middleware {
  return async (context, next) => {
    if (context.url.pathname.startsWith('/webhook/')) {
      return next() // ← bypass CSRF for webhook paths
    }
    return csrfMiddleware(context, next) // ← CSRF for everything else
  }
}
```

### Gotcha: New `createAction`/`router.post()` Routes Also Need CSRF Bypass

When you add a new POST route via `createAction` + `router.post()` (not a form), it still goes through CSRF middleware and silently returns 403 — not with "missing csrf token" but a bare 403 that looks like an auth/IP rejection.

**Scenario:** You add:

```ts
// routes.ts
export const callbackRoute = post('/callback')

// router.ts
router.post(callbackRoute, callbackReceive)
```

And `callbackReceive` returns 403 even when the controller logic looks correct. The root cause is CSRF middleware running before your handler.

**Fix:** Add the new path to the existing `skip-csrf.ts` skip list:

```ts
if (
  context.url.pathname.startsWith('/webhook/') ||
  context.url.pathname === '/callback' // ← add new routes here
) {
  return next()
}
```

**Debug tip:** When a new POST route returns 403 and the handler's logic seems correct, check `skip-csrf.ts` first. If the route isn't a browser form (server-to-server, API, callback), it needs to be added to the skip list.

````

In your middleware chain, replace the standalone `csrf()` with the wrapper:

```tsx
// app/middleware/root.ts
createMiddleware(
  ...
  session(cookie, storage),
  skipCsrf(),  // ← replaces csrf({...})
  ...
)
````

**clientEntry forms** (no server context): Inject the token from a `<meta>` tag on submission:

```tsx
<form action="/logout" method="post" id="logout-form">
  <button
    type="submit"
    mix={on('click', () => {
      let form = document.getElementById('logout-form') as HTMLFormElement
      if (form && !form.querySelector('input[name="_csrf"]')) {
        let token = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content')
        if (token) {
          let input = document.createElement('input')
          input.type = 'hidden'
          input.name = '_csrf'
          input.value = token
          form.appendChild(input)
        }
      }
    })}
  >
    Logout
  </button>
</form>
```

## CORS

```ts
import { cors } from 'remix/middleware/cors'

let router = createRouter({
  middleware: [cors({ origin: 'https://app.example.com' })],
})
```

## Cross-Origin Protection (COP)

Tokenless protection using browser provenance headers (`Sec-Fetch-*`):

```ts
import { crossOriginProtection } from 'remix/middleware/cop'

let router = createRouter({
  middleware: [crossOriginProtection()],
})
```

### SSE Streaming Endpoints Also Need CSRF Bypass

SSE streaming endpoints (POST handlers returning `text/event-stream`) called via client-side `fetch()` also return 403 — the client can't embed a CSRF token in a `fetch()` POST the way HTML forms can.

**Fix:** Add SSE endpoint paths to the CSRF skip list:

```typescript
// app/middleware/skip-csrf.ts
export function skipCsrf(): Middleware {
  return async (context, next) => {
    if (
      context.url.pathname.startsWith('/webhook/') ||
      context.url.pathname.startsWith('/callback') ||
      context.url.pathname === '/route-agent' ||
      context.url.pathname.startsWith('/route-agent/') ||
      context.url.pathname === '/mastra/chat' ||
      context.url.pathname.startsWith('/mastra/chat/')
    ) {
      return next()
    }
    return csrfMiddleware(context, next)
  }
}
```

**Optional: Custom header check for extra safety.** Since skipping CSRF entirely opens the endpoint to `<form>` CSRF attacks, add a header check that blocks requests without the expected header (forms can't set custom headers):

```typescript
if (context.url.pathname === '/mastra/chat' || context.url.pathname.startsWith('/mastra/chat/')) {
  if (context.request.headers.get('X-SSE-Request') !== '1') {
    return new Response('Forbidden', { status: 403 })
  }
  return next()
}
```

The client then sends the header:

```typescript
fetch('/mastra/chat', {
  method: 'POST',
  headers: { 'X-SSE-Request': '1' },
  body: formData,
})
```

## References

- `~/remix/packages/csrf-middleware/README.md` — CSRF token sources, origin validation, caveats
- `~/remix/packages/cors-middleware/README.md` — CORS options and configuration
- `~/remix/packages/cop-middleware/README.md` — tokenless cross-origin protection
- `~/remix/packages/session-middleware/README.md` — required by csrf()
