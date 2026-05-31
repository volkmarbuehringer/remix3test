<!-- Context: development/remix3/packages/concepts | Priority: high | Version: 1.1 | Updated: 2026-05-20 -->

# Concept: CSRF Middleware

**Purpose**: CSRF protection with synchronizer tokens backed by session storage, plus origin checks for unsafe requests.

**Key Points**:
- Session-backed synchronizer token creation and persistence
- Token extraction order: headers (`X-Csrf-Token`, `X-Xsrf-Token`, `Csrf-Token`) → form field `_csrf` → query param `_csrf`
- Custom token resolver via `value(context)` option to override extraction
- Query param tokens are weakest — avoid in favor of headers or hidden form fields (exposed in logs/history)
- Origin/Referer validation for unsafe methods; `allowMissingOrigin: true` (default) allows when both absent
- Caveats: synchronizer token is primary defense; missing origins pass by default (set `allowMissingOrigin: false` to require); prefer `cop()` in front for pre-token rejection of cross-origin requests
- Exists because Remix can't assume tokenless model guarantees — `cop()` is the lighter alternative when deployment prerequisites are met

**Minimal Example**:
```ts
import { csrf, getCsrfToken } from 'remix/middleware/csrf'
import { session } from 'remix/middleware/session'

let router = createRouter({
  middleware: [session(sessionCookie, sessionStorage), csrf({ allowMissingOrigin: false })],
})

router.get('/form', (context) => {
  let token = getCsrfToken(context)
  return new Response(`<form><input type="hidden" name="_csrf" value="${token}" /></form>`)
})
```

**Reference**: https://github.com/remix-run/remix/tree/main/packages/csrf-middleware
