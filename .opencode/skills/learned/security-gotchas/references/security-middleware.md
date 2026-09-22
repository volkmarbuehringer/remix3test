# Remix Security Middleware

**Source:** `remix-security-middleware`

Covers `remix/middleware/csrf`, `remix/middleware/cors`, `remix/middleware/cop`.

## CSRF Protection

Session-backed synchronizer token validation. For the basic setup (`csrf()` middleware, default token sources `X-Csrf-Token` header > `_csrf` form field — **query parameters are not read**, session-middleware requirement), see `node_modules/remix/src/csrf-middleware/README.md`.

### Token Sources: No Query-Param Fallback

The pinned build (`a4d62e199`, upstream #11907) **removed** the `_csrf` query-param fallback. By default `csrf()` checks the `X-Csrf-Token` / `X-Xsrf-Token` / `Csrf-Token` header, then the parsed `_csrf` form field (which requires `formData()` middleware). A request whose token is only in the URL is rejected with 403.

This repo never relied on it — `grep -rn "_csrf=" app/` is empty; every submission here is a hidden `_csrf` input (`<CsrfTokenInput />`, `app/ui/restful-form.tsx`), an `X-Csrf-Token` header, or a path skipped in `app/middleware/skip-csrf.ts`. A client that can only put the token in a URL must opt in explicitly, and the resolver **replaces** the default header+form lookup rather than adding a fallback to it:

```ts
csrf({
  value(context) {
    return context.url.searchParams.get('_csrf')
  },
})
```

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

### Skipping CSRF for External Endpoints (Webhooks) and SSE

When `csrf()` is installed globally, external callers (webhooks, API integrations) cannot provide a CSRF token, and SSE/agent streams call `fetch()` which cannot embed a form token. The repo wraps `csrf()` in a path-checking conditional — see `app/middleware/skip-csrf.ts`:

- `isExternalPath()` — webhook/API/callback paths bypass CSRF entirely (server-to-server, no browser header possible).
- `isAgentPath()` — SSE/agent paths bypass CSRF **only for GET** (EventSource is read-only) and require a custom header on non-GET (`X-Sse-Request: 1`). A cross-site `<form>` cannot set custom headers, so this blocks form CSRF while letting `fetch()` streams through.

The client sends the header on the streaming POST:

```typescript
fetch('/chat', {
  method: 'POST',
  headers: { 'X-Sse-Request': '1' },
  body: formData,
})
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

**Fix:** Add the new path to the skip list in `app/middleware/skip-csrf.ts` (`isExternalPath()` for server-to-server/API/callback, or `isAgentPath()` for SSE).

**Debug tip:** When a new POST route returns 403 and the handler's logic seems correct, check `skip-csrf.ts` first. If the route isn't a browser form (server-to-server, API, callback, SSE), it needs to be added to the skip list.

In your middleware chain, replace the standalone `csrf()` with the wrapper:

```tsx
// app/middleware/root.ts
createMiddleware(
  ...
  session(cookie, storage),
  skipCsrf(),  // ← replaces csrf({...})
  ...
)
```

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

## CORS and Cross-Origin Protection (COP)

`remix/middleware/cors` configures allowed origins; `remix/middleware/cop` is tokenless protection via browser provenance headers (`Sec-Fetch-*`). For the basic setup, see `node_modules/remix/src/cors-middleware/README.md` and `node_modules/remix/src/cop-middleware/README.md`.

## References

- `node_modules/remix/src/csrf-middleware/README.md` — CSRF token sources, origin validation, caveats
- `node_modules/remix/src/cors-middleware/README.md` — CORS options and configuration
- `node_modules/remix/src/cop-middleware/README.md` — tokenless cross-origin protection
- `node_modules/remix/src/session-middleware/README.md` — required by csrf()
- `app/middleware/skip-csrf.ts` — the repo's `skipCsrf()` wrapper (external + SSE bypass, header guard)
