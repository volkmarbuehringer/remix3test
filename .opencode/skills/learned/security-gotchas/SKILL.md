---
name: security-gotchas
description: "Use when reviewing or hardening request-handling security — CSRF/CORS/cross-origin middleware, client-IP trust and spoofing, open-redirect sanitization, IDOR ownership-scope bypass on write paths, path-traversal guards, and CSP nonces for inline scripts."
user-invocable: false
origin: consolidated
---

# Security Gotchas

**Consolidated from:** `remix-security-middleware`, `remix3-two-tier-ip-trust-model`, `remix3-return-to-open-redirect`, `idor-scope-write-bypass`, `nodejs-path-traversal-guard`, `remix3-csp-inline-scripts`

This skill is the **index** for request-handling security deltas. For the framework middleware APIs themselves (`remix/middleware/csrf`, `cors`, `cop`, `session`), use the vendor `remix` skill (`.opencode/skills/remix/SKILL.md`) and the package READMEs it points at.

## Load Only The References You Need

| Task involves... | Start with |
| --- | --- |
| Every non-GET request returns 403 ("missing csrf token"), a webhook/SSE/agent POST needs to bypass CSRF, or a new `createAction`/`router.post()` route returns a bare 403 | `references/security-middleware.md` |
| Choosing a client IP for a localhost guard, login rate limit, or admin allowlist vs. audit logging; `trustProxy` and `X-Forwarded-For` spoofing | `references/two-tier-ip-trust-model.md` |
| Sanitizing a `returnTo`/`next`/`redirect` query param; an origin-only check still allows a path that normalizes to `//host` | `references/return-to-open-redirect.md` |
| Fixing an IDOR by scoping reads, when a write path SETs the owner column or the row id comes from client input | `references/idor-scope-write-bypass.md` |
| Restricting filesystem access to a project root; reviewing `path.resolve(x, y).startsWith(x)` or symlink escapes | `references/path-traversal-guard.md` |
| An inline `<script>` is blocked by CSP, or a `clientEntry` loses early clicks to the async `import()` gap | `references/csp-inline-scripts.md` |

## Core Rules

**CSRF / CORS / COP middleware (`references/security-middleware.md`)**

- A globally installed `csrf()` validates **every** non-GET request: any `<form method="POST">` missing a hidden `_csrf` field gets **403 "missing csrf token"** — add `<CsrfTokenInput />` (SSR-renders `<input type="hidden" name="_csrf">` from async request context). Default token sources are `X-Csrf-Token` header > `_csrf` form field > `_csrf` query param, and CSRF requires session middleware.
- External endpoints cannot present a token, so wrap `csrf()` in a path-checking `skipCsrf()` (repo: `app/middleware/skip-csrf.ts`): `isExternalPath()` bypasses webhooks/API/callbacks entirely; `isAgentPath()` bypasses SSE/agent paths **only for GET** and requires `X-Sse-Request: 1` on non-GET (a cross-site `<form>` cannot set custom headers). New `createAction`/`router.post()` routes silently 403 with a bare status that looks like an auth/IP rejection — check `skip-csrf.ts` first. `clientEntry` forms inject the token from `<meta name="csrf-token">` on submit. `remix/middleware/cors` sets allowed origins; `remix/middleware/cop` is tokenless protection via browser provenance headers (`Sec-Fetch-*`).

**Two-tier IP trust model (`references/two-tier-ip-trust-model.md`)**

- Split IP resolution in two: `connectionIp()` (trusted — the `X-Client-Ip` header stamped by `server.ts` from the TCP socket) for **security** decisions (localhost guards, login rate limits, admin allowlists), and `sourceIp()` (untrusted fallback chain `X-Client-Ip` → `Cf-Connecting-Ip` → `X-Forwarded-For` → `X-Real-Ip`) for **logging/audit/analytics only**. `X-Forwarded-For` and `X-Real-Ip` are client-spoofable (e.g. `X-Forwarded-For: 127.0.0.1` passing a localhost guard).
- `X-Client-Ip` is trustworthy **only with `trustProxy: false`**: `trustProxy: true` derives `client.address` from spoofable forwarded headers and re-enables the attack, unless a trusted reverse proxy strips/rewrites them. Always `set()` (not append) the header so a client cannot smuggle its own. Rate-limit on the socket tier; admin-only agent endpoints should skip IP and key on `auth.identity.id` with `perUser: true`.

**`returnTo` open redirect (`references/return-to-open-redirect.md`)**

- An origin-only sanitizer still passes a same-origin value whose **pathname** starts with `//`: `new URL('//remix.local//evil.com', 'https://remix.local')` has origin `https://remix.local` but pathname `//evil.com`, and `Location: //evil.com` navigates to `evil.com` (protocol-relative). Reject unless the input `startsWith('/')`, then check **both** `url.origin !== baseURL` **and** `url.pathname.startsWith('//')`, and return `pathname + search + hash`. Upstream fixed the same class in `@remix-run/auth` `sanitizeReturnTo` (PR #11857); URL parsing already normalizes the backslash variant `/\evil.com` off-origin.

**IDOR ownership-claim write bypass (`references/idor-scope-write-bypass.md`)**

- Scoping only READ queries does not fix an IDOR: an unscoped write that **SETs the owner column** (`UPDATE ... SET user_id = $1 WHERE id = $2`) lets any authenticated user claim any row by id, then read it through the newly-scoped path (e.g. `file=42` then `GET /resource/42`). Scope the claim to orphan-or-owned rows — `WHERE id = $2 AND (uploaded_by IS NULL OR uploaded_by = $1)` — and include the owner column in the WHERE of **every** DELETE/UPDATE path.
- That scoped claim is still bypassable when the row `id` is client-supplied (a plain-text `file=<victimId>` claims any unclaimed upload). Carry a **server-generated** id through a request-scoped channel instead: an `AsyncLocalStorage` scope middleware **before** the body parser (`uploadClaimScope()`), `setUploadedId(id)` after `INSERT … RETURNING id` in the upload handler, and post-auth claim only `takeUploadedId()` — never `context.formData.get('file')`. `setUploadedId` must throw when the scope is missing so a middleware reorder fails loudly.

**Path-traversal guard (`references/path-traversal-guard.md`)**

- `path.resolve(root, userPath).startsWith(root)` silently passes sibling directories sharing the root's prefix (`/home/project/my-app-leaks/.env` starts with `/home/project/my-app`), and `path.resolve` does not resolve symlinks. Use `path.relative(projectRoot, resolved)` and reject when `rel.startsWith('..') || path.isAbsolute(rel)`; call `realpathSync(process.cwd())` **once** at module load, and for read operations re-resolve the target with `fs.realpath` and repeat the `path.relative` check (a `node_modules/.bin/pkg` symlink to `/etc` otherwise escapes). In review, flag any `path.resolve(x, y).startsWith(x)` as a probable vulnerability.

**CSP inline scripts (`references/csp-inline-scripts.md`)**

- A bare `<script>{code}</script>` is silently blocked by the `script-src 'self' 'nonce-...'` policy from `security-headers.ts`; render `<script nonce={getCspNonce()}>` so it executes synchronously on parse (no `clientEntry` `import()` timing gap that loses early clicks).
- The separate "content escaping" failure mode (`<`/`>` in JS string literals SSR-escaped to `&lt;`/`&gt;`) is **fixed upstream** (commit `8ddca1f04`, `escapeScriptTextContent()` now preserves `<`/`>` and only escapes `</script`/`<script` sequences), so only the nonce requirement remains; prefer `clientEntry` if the handler needs dynamic props or re-rendering.

## When to Use

- You are reviewing or hardening request handling in a Remix 3 app: CSRF/CORS/COP middleware, client-IP trust, redirect sanitization, ownership scoping, filesystem paths, or CSP.
- A request returns 403 (especially a bare status on a new POST route), a redirect points at an attacker host, one user can read/claim another user's row, a path escapes the project root, or an inline script is blocked.
- Before shipping a new POST route, an IP-based auth/rate-limit check, an upload ownership claim, a file-serving endpoint, or an inline script.

## Related Skills

- vendor `remix` skill (`.opencode/skills/remix/SKILL.md`) — canonical CSRF/CORS/COP/session middleware and security-headers APIs
- `remix-file-uploads` — the upload pipeline whose ownership claim must come from the server-scoped id, not the `file` form field
- `remix3-agent-routing` — agent endpoints that need the SSE CSRF bypass and `X-Sse-Request` header
- `mastra-agent` — SSE streaming endpoints (CSRF bypass only for GET, header guard on POST)
- `mastra-tools` — approval-form endpoints that still need a CSRF token
- `remix3-route-wiring` (`references/standalone-route-admin-sidebar.md`) — standalone admin routes that authenticate over SSE and extract the client IP
- `remix3-bun-runtime` — Bun's `server.requestIP()` TCP-socket tier that keeps `X-Client-Ip` unspoofable
