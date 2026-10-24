# CSP-safe inline scripts in Remix 3

**Source:** `remix3-csp-inline-scripts`

**Extracted:** 2026-07-09
**Context:** Adding client-side JavaScript (password toggles, live form feedback, etc.) in Remix 3 apps with Content-Security-Policy

## Problem

A bare `<script>{code}</script>` in a Remix 3 component has one silent failure mode:

1. **CSP block**: The `security-headers.ts` middleware sets `script-src 'self' 'nonce-...'`. An inline script without a matching `nonce` attribute is silently blocked.

`clientEntry` avoids that (module `import()` is allowed by `'self'`), but introduces an async timing gap — clicks during the `import()` are lost because the event listener hasn't been registered yet.

> **History (no action needed):** Remix used to SSR-escape `<`/`>` in script string children, corrupting JS literals. That is fixed in the installed build — `@remix-run/component/src/server/stream.ts` renders script text through `escapeScriptTextContent()`, which only neutralizes `</script`/`<script` sequences. No workaround is required; the CSP nonce is the only live constraint.

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

The script executes synchronously when the browser parses it — no `import()` delay, no escaping issue, passes CSP.

This pattern already exists in the codebase for theme initialization (`document.tsx:83`) and all admin JSON data scripts.

## When to Use

- CSP violation on an inline `<script>` in the console
- A `clientEntry` handler needs "several clicks" to start working (async `import()` gap)
- The handler doesn't need dynamic props or re-rendering (use `clientEntry` if it does)
