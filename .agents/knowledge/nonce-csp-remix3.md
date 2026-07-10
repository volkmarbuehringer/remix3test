---
title: 'Nonce-based CSP in Remix 3 with per-request nonces'
tags: [csp, security, nonce, security-headers, xss, remix3]
created: 2026-05-31
status: active
---

## Problem

The Content-Security-Policy used `'unsafe-inline'` on `script-src`, which means any XSS vulnerability can execute arbitrary JavaScript in the browser. The CSP had no mechanism to distinguish trusted scripts from injected ones.

## Solution

Generate a cryptographically random nonce per request and:

1. Include it in the CSP header via `'nonce-<value>'`
2. Apply it as the `nonce` attribute on every `<script>` tag in the HTML

**Security-headers middleware — per-request nonce generation:**

```typescript
import { createContextKey, type Middleware } from 'remix/router'
import { getContext } from 'remix/middleware/async-context'

const cspNonceKey = createContextKey<string>()

export function getCspNonce(): string | undefined {
  try {
    return getContext().get(cspNonceKey)
  } catch {
    return undefined
  }
}

export function securityHeaders(): Middleware {
  return async (context, next) => {
    let nonce = crypto.randomUUID()
    context.set(cspNonceKey, nonce)

    let response = await next()

    let csp = [
      `default-src 'self'`,
      `script-src 'self' 'nonce-${nonce}'`,
      // style-src can still use 'unsafe-inline' for SSR frameworks
      `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`,
      // ... other directives
    ].join('; ')

    let headers = new Headers(response.headers)
    if (!headers.has('Content-Security-Policy')) {
      headers.set('Content-Security-Policy', csp)
    }
    // ... other headers

    return new Response(response.body, { headers, ... })
  }
}
```

**Document component — apply nonce to all `<script>` tags:**

```typescript
import { getCspNonce } from '../middleware/security-headers.ts'

// Inline script:
<script nonce={getCspNonce()}>{`...`}</script>

// Module script:
<script type="module" src={src} nonce={getCspNonce()} />

// JSON data script:
<script id="appointment-data" type="application/json" nonce={getCspNonce()}>
```

## Why

A nonce-based CSP allows only scripts with the correct `nonce` attribute to execute. An attacker who injects a `<script>` tag won't know the per-request nonce, so their payload is blocked by the browser. `'unsafe-inline'` disables this protection entirely.

The nonce is generated once per request using `crypto.randomUUID()` and stored in the async context via `context.set()`/`getContext().get()`, making it accessible in any component during rendering without prop drilling.
