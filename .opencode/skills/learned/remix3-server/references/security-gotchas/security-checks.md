# Security Checks (CSP, redirects, filesystem paths)

**Source:** consolidated from `remix3-csp-inline-scripts`, `remix3-return-to-open-redirect`, `nodejs-path-traversal-guard`

**Extracted:** 2026-07-09 … 2026-09-17
**Context:** Three request-boundary checks that are easy to get subtly wrong. For CSRF/ownership/authz see `security-middleware.md` and `idor-scope-write-bypass.md`.

## CSP-safe inline scripts

`security-headers.ts` sets `script-src 'self' 'nonce-...'`, so a bare `<script>{code}</script>` is silently blocked. A `clientEntry` avoids CSP (module `import()` is allowed by `'self'`) but adds an async gap — clicks during the import are lost.

Use the request-scoped nonce for synchronous inline scripts:

```tsx
import { getCspNonce } from '~/middleware/security-headers.ts'

export function PasswordToggle() {
  let nonce = getCspNonce()
  return () => <script nonce={nonce}>{PASSWORD_TOGGLE_SCRIPT}</script>
}
```

This is the shape used for theme initialization (`app/ui/document.tsx:83`) and the admin JSON data scripts. Use `clientEntry` instead when the handler needs props or re-rendering.

The old SSR escaping bug (`` `<`/`>` in script children) is fixed in the installed build — `escapeScriptTextContent()` only neutralizes `</script`/`<script`; the nonce is the only live constraint.

## `returnTo` open redirect: reject paths normalizing to `//host`

Checking only `url.origin === base` misses a same-origin input whose **pathname** starts with `//`:

```ts
new URL('//remix.local//evil.com', 'https://remix.local')
// origin:   https://remix.local  ← passes the origin check
// pathname: //evil.com           ← becomes Location: //evil.com
```

Browsers treat `Location: //evil.com` as protocol-relative and navigate off-site. Guard the returned pathname too:

```ts
if (!returnTo.startsWith('/')) return undefined
let url = new URL(returnTo, baseURL)
if (url.origin !== baseURL || url.pathname.startsWith('//')) return undefined
return url.pathname + url.search + url.hash
```

`app/utils/redirect.ts` (`getSafeReturnTo`) does this, with a regression test in `app/utils/redirect.test.ts` (`//remix.local//evil.com` → `undefined`). The `startsWith('/')` gate rejects absolute URLs; URL parsing normalizes backslashes (`/\evil.com` resolves off-origin and fails the origin check).

Upstream fixed the same class in `@remix-run/auth`'s `sanitizeReturnTo` (PR #11857) by adding `|| url.pathname.startsWith('//')`.

## Filesystem path traversal: use `path.relative`, not `startsWith`

`path.resolve(root, userPath).startsWith(root)` fails for sibling directories sharing the root prefix:

```ts
let root = '/home/project/my-app'
let resolved = path.resolve(root, '../my-app-leaks/.env')
// '/home/project/my-app-leaks/.env'
resolved.startsWith(root) // true — BUG
```

`path.resolve` also does not resolve symlinks; a symlink to `/etc` passes.

Use `path.relative` for the prefix check and realpath for symlinks:

```ts
import * as path from 'node:path'
import { realpathSync } from 'node:fs'
import * as fs from 'node:fs/promises'

let projectRoot = realpathSync(process.cwd()) // once at module load

function resolveSafe(subdir: string): { ok: true; resolved: string } | { ok: false; error: string } {
  let resolved = path.resolve(projectRoot, subdir)
  let rel = path.relative(projectRoot, resolved)
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    return { ok: false, error: 'Path traversal detected' }
  }
  return { ok: true, resolved }
}

async function readFileSafely(filePath: string) {
  let resolved = resolveSafe(filePath)
  if (!resolved.ok) return resolved
  let real = await fs.realpath(resolved.resolved)
  let relReal = path.relative(projectRoot, real)
  if (relReal.startsWith('..') || path.isAbsolute(relReal)) {
    return { error: 'Path traversal detected (symlink)' }
  }
  return { content: await fs.readFile(real, 'utf-8') }
}
```

Review rule: flag any `path.resolve(x, y).startsWith(x)` as a probable vulnerability.

## When to Use

- A CSP violation on an inline `<script>`, or a `clientEntry` handler needs several clicks to start working.
- Writing/reviewing a `returnTo`/`next`/`redirect` sanitizer that returns `pathname`/`pathname + search`.
- An endpoint takes a user-controlled path to the filesystem, or code review finds `path.resolve(...).startsWith(...)`.
