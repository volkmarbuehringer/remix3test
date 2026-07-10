---
name: remix3-csp-inline-scripts
description: 'Use CSP nonces for inline scripts in Remix 3 to avoid blocking and escapeTextContent escaping'
user-invocable: false
origin: auto-extracted
---

# CSP-safe inline scripts in Remix 3

**Extracted:** 2026-07-09
**Context:** Adding client-side JavaScript (password toggles, live form feedback, etc.) in Remix 3 apps with Content-Security-Policy

## Problem

A bare `<script>{code}</script>` in a Remix 3 component has two silent failure modes:

1. **CSP block**: The `security-headers.ts` middleware sets `script-src 'self' 'nonce-...'`. An inline script without a matching `nonce` attribute is silently blocked.

2. **Content escaping**: Remix's `buildElementSegment` passes string children through `escapeTextContent()` (`<` → `&lt;`, `>` → `&gt;`). Any JS string literal containing `<` or `>` (e.g., `innerHTML = '<use href="..."/>'`) gets silently corrupted.

`clientEntry` avoids both issues (module `import()` is allowed by `'self'`), but introduces an async timing gap — clicks during the `import()` are lost because the event listener hasn't been registered yet.

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

The script executes synchronously when the browser parses it — no `import()` delay, no escaping corruption, passes CSP.

This pattern already exists in the codebase for theme initialization (`document.tsx:62`) and all admin JSON data scripts.

## When to Use

- CSP violation on an inline `<script>` in the console
- JavaScript silently fails because `<`/`>` in string literals were escaped to `&lt;`/`&gt;`
- A `clientEntry` handler needs "several clicks" to start working (async `import()` gap)
- The handler doesn't need dynamic props or re-rendering (use `clientEntry` if it does)
