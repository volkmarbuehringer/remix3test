# Remix Security Middleware

**Source:** `remix-security-middleware`

**Revalidated:** 2026-11-15 against preview release `v0.20261114.200722-main-3fac48ab` / source `3fac48ab` (chapter 10 re-audit). Token sources, origin-resolver semantics, and the `allowMissingOrigin` default below were re-read from the installed `@remix-run/csrf-middleware` source.

Covers `remix/middleware/csrf`, `remix/middleware/cors`, `remix/middleware/cop`.

## CSRF Protection

Session-backed synchronizer token validation. For the basic setup (`csrf()` middleware, default token sources `X-Csrf-Token` header > `_csrf` form field — **query parameters are not read**, session-middleware requirement), see `node_modules/remix/src/csrf-middleware/README.md`.

### Token Sources: No Query-Param Fallback

Upstream #11907 **removed** the `_csrf` query-param fallback (re-checked 2026-11-04 against the pinned `@remix-run/csrf-middleware`: token sources are headers then the parsed form field). By default `csrf()` checks the `X-Csrf-Token` / `X-Xsrf-Token` / `Csrf-Token` header, then the parsed `_csrf` form field (which requires `formData()` middleware). A request whose token is only in the URL is rejected with 403.

This repo never relied on it — `grep -rn "_csrf=" app/` is empty; every submission here is a hidden `_csrf` input (`<CsrfTokenInput />`, `app/ui/restful-form.tsx`), an `X-Csrf-Token` header, or a path skipped in `app/middleware/skip-csrf.ts`. A client that can only put the token in a URL must opt in explicitly, and the resolver **replaces** the default header+form lookup rather than adding a fallback to it:

```ts
csrf({
  value(context) {
    return context.url.searchParams.get('_csrf')
  },
})
```

### Common Pitfall: Every POST Form Needs a CSRF Token Input

When `csrf()` is installed globally, every non-GET request is validated. A `<form method="POST">` without a hidden `_csrf` field will get a **403 Forbidden** with "Forbidden: missing CSRF token" in the server log.

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
- `isAgentPath()` — GET (EventSource is read-only) and non-GET requests carrying `X-Sse-Request: 1` pass through unvalidated; a cross-site `<form>` cannot set that header. Any other non-GET now **falls through to the regular `csrf()` synchronizer-token check** instead of a blanket 403, so a server-rendered form can submit with a hidden `_csrf` input while a cross-site form still fails the token/origin check. See `remix-forms` → `references/native-form-on-sse-decision.md`.
- Uploads: `skipCsrf()` must stay after `uploadFormData()` because `csrf()` reads `_csrf` from the parsed form. `uploadFormData()` therefore performs its own pre-parse auth (401) and `isAllowedCsrfOrigin()` origin/`Sec-Fetch-Site` check (403) on the uploads action before the body is read; see `app/middleware/uploads.ts`.

The client sends the header on the streaming POST:

```typescript
fetch('/chat', {
  method: 'POST',
  headers: { 'X-Sse-Request': '1' },
  body: formData,
})
```

### Gotcha: New `createAction`/`router.post()` Routes Also Need CSRF Bypass

When you add a new POST route via `createAction` + `router.post()` (not a form), it still goes through CSRF middleware and silently returns 403 — not with "Forbidden: missing CSRF token" but a bare 403 that looks like an auth/IP rejection.

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

### Origin resolver semantics (app: `app/middleware/skip-csrf.ts`)

`csrf({ origin })` accepts a string, regex, array, or function. The app passes a **function** (`isAllowedCsrfOrigin`), so at this pin:

- The resolver only runs when the request carries `Origin`, or a parseable `Referer` (the vendor derives the origin from either). Its result must be exactly `true`.
- With **no** `Origin`/`Referer`, the vendor returns `allowMissingOrigin` (default `true`) and never calls the resolver. A missing-origin unsafe request still needs a valid synchronizer token; the token is the primary defense.
- The app keeps the default, so a token-bearing non-browser POST with no provenance header passes. If a deployment wants to require provenance headers, set `allowMissingOrigin: false` — but then every non-browser form client must send `Origin`.
- `context.url.origin` is the routing origin, not the browser origin: behind a Cloudflare quick tunnel the browser `Origin` is the tunnel hostname while the app sees localhost. The app's resolver therefore trusts `PUBLIC_ORIGIN` (or the origin file) and accepts `*.trycloudflare.com` only when `Sec-Fetch-Site` is `same-origin`/`none` (a header a page cannot forge). Keep the token check after this origin layer.

### COP is not installed (deliberate)

`app/middleware/root.ts` installs `skipCsrf()` (which delegates to `csrf()`), not `cop()`. The app already has the provenance layer the guide describes, inside `csrf()`: exact same-origin, the configured public origin, and the narrow tunnel exception. It is not an **early** layer — session creation and body parsing happen first for non-upload unsafe requests — but it covers the same trusted-origin exceptions, and `uploadFormData()` runs `isAllowedCsrfOrigin()` before the body is read for the two upload actions. Adding a global `cop()` would require `insecureBypassPatterns` for the same external paths `isExternalPath()` already exempts (`/webhook`, `/app-webhook`, `/callback`, `/csp-reports`, `/api/`) and would reject external callers that send an `Origin` header; do not add it without those bypasses and a webhook regression test.

### CORS is not installed (deliberate)

`cors()` is absent because no browser endpoint is meant to be called cross-origin: the JSON API under `/api/` is for server-to-server Bearer-token callers, and the agent/SSE transports are same-origin. The browser contract is enforced by CSP `connect-src 'self'`, `form-action 'self'`, and `frame-ancestors 'none'` (`app/middleware/security-headers.ts`). If a cross-origin browser caller is ever added, install `cors()` on that endpoint only with an exact origin, explicit credentials/headers, and preflight handling — CORS headers do not authenticate or authorize the caller.

## References

- `node_modules/remix/src/csrf-middleware/README.md` — CSRF token sources, origin validation, caveats
- `node_modules/remix/src/cors-middleware/README.md` — CORS options and configuration
- `node_modules/remix/src/cop-middleware/README.md` — tokenless cross-origin protection
- `node_modules/remix/src/session-middleware/README.md` — required by csrf()
- `app/middleware/skip-csrf.ts` — the repo's `skipCsrf()` wrapper (external + SSE bypass, header guard)
