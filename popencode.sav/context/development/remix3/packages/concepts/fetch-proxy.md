<!-- Context: development/remix3/packages/concepts | Priority: medium | Version: 1.0 | Updated: 2026-04-02 -->

# Concept: Fetch Proxy

**Purpose**: HTTP proxy utilities built on web Fetch API. Forward requests to target servers with optional header/cookie rewriting.

**Key Points**:
- Built on standard JavaScript Fetch API
- Cookie rewriting for Set-Cookie headers
- Forwarding headers (X-Forwarded-Proto, X-Forwarded-Host)
- Custom fetch implementation support

**Minimal Example**:
```ts
import { createFetchProxy } from 'remix/fetch-proxy'

let proxy = createFetchProxy('https://remix.run')

async function handleFetch(request) {
  return proxy(request)
}

let response = await handleFetch(new Request('https://shopify.com'))
```

**Reference**: https://github.com/remix-run/remix/tree/main/packages/fetch-proxy