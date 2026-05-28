<!-- Context: development/remix3/packages/concepts | Priority: high | Version: 1.1 | Updated: 2026-05-20 -->

# Concept: COP Middleware

**Purpose**: Tokenless cross-origin protection using browser provenance headers (Sec-Fetch-Site, Origin). Mirrors Go's CrossOriginProtection.

**Key Points**:
- Blocks unsafe cross-origin requests (POST/PUT/PATCH/DELETE) without synchronizer tokens
- Behavior: allow `Sec-Fetch-Site: same-origin` & `none`; reject other values unless trusted/insecure bypass
- Falls back from `Sec-Fetch-Site` to `Origin` vs request host comparison; allows if both are missing (older clients / non-browser callers)
- Trusted origins: exact `scheme://host[:port]`; insecure bypass patterns: method prefixes, exact paths, trailing-slash subtrees (`/webhooks/`), single-segment wildcards (`{name}`), tail wildcards (`{name...}`)
- Caveats: browser-origin guard, not universal CSRF; missing both headers = allowed intentionally; for session-backed forms, layer with `csrf()`

**Minimal Example**:
```ts
import { cop } from 'remix/middleware/cop'
import { csrf } from 'remix/middleware/csrf'
import { session } from 'remix/middleware/session'

// Layered: cop() runs first, then session + csrf() for synchronizer tokens
let router = createRouter({
  middleware: [cop(), session(sessionCookie, sessionStorage), csrf()],
})

// Trusted origins + insecure bypass patterns
cop({ trustedOrigins: ['https://admin.example.com'],
      insecureBypassPatterns: ['POST /webhooks/{provider}', '/healthz'] })
```

**Reference**: https://github.com/remix-run/remix/tree/main/packages/cop-middleware
