# Security Checks (CSP, redirects, filesystem paths)

**Source:** consolidated from `remix3-csp-inline-scripts`, `remix3-return-to-open-redirect`, `nodejs-path-traversal-guard`; the CSP section absorbed the nonce/policy deltas that used to live inline in `remix3-server § Security`.

**Extracted:** 2026-07-09 … 2026-09-17
**Revalidated:** 2026-11-11 against preview release `v0.20261111.171719-main-0cab1903` / source `0cab1903` — CSP now comes from the vendor `csp()` middleware, not a local implementation.
**Context:** Three request-boundary checks that are easy to get subtly wrong. For CSRF/ownership/authz see `security-middleware.md` and `idor-scope-write-bypass.md`.

## CSP-safe inline scripts

The app delegates policy and nonce ownership to `csp()` from `remix/middleware/csp` (`app/middleware/root.ts`), configured by `contentSecurityPolicy()` in `app/middleware/security-headers.ts`. `getCspNonce()` there is a thin adapter over the vendor `getCspNonce(getContext())`.

Use the request-scoped nonce for synchronous inline scripts:

```tsx
import { getCspNonce } from '~/middleware/security-headers.ts'

export function PasswordToggle() {
  let nonce = getCspNonce()
  return () => <script nonce={nonce}>{PASSWORD_TOGGLE_SCRIPT}</script>
}
```

This is the shape used for theme initialization (`app/ui/document.tsx`) and the admin JSON data scripts. A `clientEntry` avoids the nonce (module `import()` is allowed by `'self'`) but adds an async gap — clicks during the import are lost. Prefer `clientEntry` when the handler needs props or re-rendering.

The old SSR escaping bug (`<`/`>` in script children) is fixed in the installed build — `escapeScriptTextContent()` only neutralizes `</script`/`<script`; the nonce is the only live constraint.

## CSP styles: nonce-gated elements, no inline attributes

`csp()` stamps generated CSS mixin styles with the nonce. The app splits the style policy:

- `style-src-elem 'self' 'nonce-…'` gates authored `<style>` elements.
- `style-src-attr 'none'` blocks every `style="…"` attribute, server-rendered or via `setAttribute('style')`.
- `style-src 'self' 'nonce-…'` is the fallback for browsers without the split directives.

Every authored `<style>` must carry `getCspNonce()` (document shell, `Theme`/`DarkTheme.Style` via their `nonce` prop, `HomeStyles`). A client-created `<style>` cannot be nonced — move its CSS into the nonced document shell. In JSX use `mix={css({…})}`; CSSOM (`el.style.foo = …`, `el.style.cssText`) is **not** CSP-checked, so per-frame geometry and client-side visibility toggles use refs/`hidden`, not style props. Markup built as strings (`customer-chat-render.ts`, `agent-events-log.ts`) carries class names styled by descendant rules in `app/ui/agent-chat/stream-styles.ts`, attached to the surface container. `app/middleware/security-headers.test.ts` renders the key routes and asserts no `\sstyle="` appears; add a route there when a new page starts emitting one.

## CSP import maps: no `blob:` source

The Firefox multiple-import-maps polyfill evaluates blob module scripts, but they inherit the nonce of the nonced entry script and `<link rel="modulepreload">` tags (vendor polyfill README). `app/ui/document.tsx` nonces every authored preload and the entry script, so `script-src` needs no `blob:`; dropping either nonce reintroduces the need. The server test asserts the nonces.

## CSP violation reporting and Trusted Types

The policy uses `report-uri /csp-reports` (deliberately not `report-to`: Chromium's Reporting API batches for tens of seconds, `report-uri` is immediate in Chromium and Firefox). `app/actions/csp-reports/controller.tsx` accepts `application/csp-report` and `application/reports+json`, caps the body at 16 KB, trims/strips control characters before logging, dedupes identical sinks for 5 minutes, and caps reports at 120/min per IP (silent 204 over the cap). The route is CSRF-exempt in `skip-csrf.ts`.

The Trusted Types policy is report-only: enforcement is blocked by the pinned vendor runtime, which assigns string HTML to `innerHTML` (`component/dist/runtime/frame.js`, `component/dist/runtime/reconcile.js`, `component/dist/runtime/prefetch.js`); do not add `require-trusted-types-for` to the enforced policy until upstream emits TrustedHTML (a `default` identity policy would be security theater). Both engines implement Trusted Types (verified in the pinned Playwright Chromium 158 and Firefox 159, which expose `window.trustedTypes`/`TrustedHTML` and fire report-only `require-trusted-types-for` violations), so browser-specific test assumptions must not rely on Chromium-only support.

## CSP policy shape

`connect-src` stays first-party (`'self'` plus `ws://localhost:44100` only when `REMIX_NODE_HMR=1`). AI traffic is server-side (`app/utils/ai-provider.ts`, `app/actions/mastra/*`), so a provider origin must not be re-added to the browser policy. `object-src`/`frame-src`/`worker-src`/`media-src`/`manifest-src` and `base-uri` are `'none'` (no iframe/plugin/worker/media/manifest/`<base>` in `app/`); `img-src` is `'self'` because the favicon moved to `public/favicon.svg` — keep `data:` out unless a data-URI image returns.

Hardening headers (`securityHeaders()`, kept separate from `csp()`) cover COOP/CORP `same-origin`, `Origin-Agent-Cluster: ?1`, `X-Permitted-Cross-Domain-Policies: none`, and `X-Dns-Prefetch-Control: off` (oxlint wants that exact casing); `Permissions-Policy` explicitly denies every unused powerful feature (`clipboard-read/write`, `fullscreen`, `picture-in-picture`, `screen-wake-lock`, `serial`, `hid`, `bluetooth`, `local-fonts`, `encrypted-media`, `publickey-credentials-get`, `browsing-topics`).

`securityHeaders()` also defaults `text/html` to `Cache-Control: private, no-store` (every document carries the request nonce) and 4xx/5xx to `no-store`; it only fills a missing `Cache-Control`, so route-owned policies (`/health`, uploads, SSE, `/ui`) win. It collapses an exactly repeated `Content-Security-Policy` value: `frameRedirects()` re-enters the stack, so an in-frame PRG follow passes through `csp()` twice. Any internal router re-entry that embeds HTML in the same document must call `inheritCspNonce(request, nonce)` before `context.router.fetch` (done in `app/middleware/frame-redirect.ts`); otherwise the inner `csp()` appends a second policy with a fresh nonce and the frame runtime's nonce-only style elements are blocked.

The 500 page is built outside the middleware chain, so it applies `applyHardeningHeaders()` itself and carries a static script-less `serverErrorContentSecurityPolicy` (`default-src 'none'; style-src 'unsafe-inline'; …`) plus `Cache-Control: no-store`. That `style-src 'unsafe-inline'` is the only exception in the app — keep it in sync when the routed policy changes.

## CSP route matrix test

`installCspViolationCollector()` in `test/csp.ts` installs the `securitypolicyviolation` listener via `addInitScript` (before navigation, refreshed per document) and only fails on `disposition !== 'report'` (report-only policies are expected to fire). `app/middleware/security-headers.test.e2e.ts` runs it over the anonymous + admin matrix (including `/chat`, `/admin/agent-events`, and `/scroll-restoration`), a lists copy PRG that must be followed in-frame (zero document `load` events), and a report-delivery test that injects an inline script and waits for the `/csp-reports` POST, in both configured playwright projects.

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

- A CSP violation on an inline `<script>` or `<style>`, a blocked `style="…"` attribute, or a `clientEntry` handler needs several clicks to start working.
- You are changing the CSP policy, reporting endpoint, Trusted Types rollout, or the CSP route-matrix test.
- Writing/reviewing a `returnTo`/`next`/`redirect` sanitizer that returns `pathname`/`pathname + search`.
- An endpoint takes a user-controlled path to the filesystem, or code review finds `path.resolve(...).startsWith(...)`.
