# CSP-safe inline scripts in Remix 3

**Source:** `remix3-csp-inline-scripts`

**Extracted:** 2026-07-09
**Context:** Adding client-side JavaScript (password toggles, live form feedback, etc.) in Remix 3 apps with Content-Security-Policy

## Problem

A bare `<script>{code}</script>` in a Remix 3 component has two silent failure modes:

1. **CSP block**: The `security-headers.ts` middleware sets `script-src 'self' 'nonce-...'`. An inline script without a matching `nonce` attribute is silently blocked.

2. **Content escaping** (FIXED upstream, see below): Remix's `buildElementSegment` passed string children through `escapeTextContent()` (`<` → `&lt;`, `>` → `&gt;`). Any JS string literal containing `<` or `>` (e.g., `innerHTML = '<use href="..."/>'`) got silently corrupted.

`clientEntry` avoids both issues (module `import()` is allowed by `'self'`), but introduces an async timing gap — clicks during the `import()` are lost because the event listener hasn't been registered yet.

> **Version-pinned update:** The content-escaping half (#2) is **no longer an issue** as of commit
> `8ddca1f04` ("Preserve script text content during SSR", on `preview/main`, installable build `2f0e40303`).
> `packages/ui/src/server/stream.ts:636` renders `<script>{children}</script>` through
> `escapeScriptTextContent()` (defined at `:1247`), which only escapes `</script` / `<script`
> sequences (as `\u0073`/`\u0053`) and **preserves** `<`/`>` in JS string literals. Only the
> CSP-nonce requirement (#1) still applies. Re-confirmed 2026-09-24 against the installed
> `node_modules/.pnpm/@remix-run+ui@*/node_modules/@remix-run/ui/src/server/stream.ts` @ `9ed3a5c`
> (installable build `3e516fcc2`); PR #11885 added the raw-HTML guard and the `innerHTML` render site
> is now `:627-628`.

## Solution

Use `<script nonce={getCspNonce()}>` — an inline script with the request-scoped CSP nonce:

```tsx
import { getCspNonce } from '~/middleware/security-headers.ts'

export function PasswordToggle() {
  let nonce = getCspNonce()
  return () => <script nonce={nonce}>{PASSWORD_TOGGLE_SCRIPT}</script>
}

const PASSWORD_TOGGLE_SCRIPT = `
document.addEventListener('click', function(e) {
  var btn = e.target.closest('[data-toggle-pw]');
  if (!btn) return;
  // ... handler ...
});
`
```

The script executes synchronously when the browser parses it — no `import()` delay, and (post-`8ddca1f04`) no escaping corruption, passes CSP.

This pattern already exists in the codebase for theme initialization (`document.tsx:62`) and all admin JSON data scripts.

## When to Use

- CSP violation on an inline `<script>` in the console
- JavaScript fails because `<`/`>` in string literals came back escaped to `&lt;`/`&gt;` — **only affects builds older than `8ddca1f04`; on current `preview/main` this no longer happens**
- A `clientEntry` handler needs "several clicks" to start working (async `import()` gap)
- The handler doesn't need dynamic props or re-rendering (use `clientEntry` if it does)
