---
name: remix-fetch-proxy
description: Build HTTP proxies using `remix/fetch-proxy` with cookie rewriting and X-Forwarded header support. Activate when forwarding requests to another origin or building a reverse proxy.
---

# Remix Fetch Proxy

Covers `remix/fetch-proxy`.

## Usage

```ts
import { createFetchProxy } from 'remix/fetch-proxy'

let proxy = createFetchProxy('https://upstream.example.com')

function handleFetch(request: Request): Promise<Response> {
  return proxy(request)
}
```

## Cookie and Header Rewriting

`createFetchProxy` rewrites `Set-Cookie` domain/path attributes from the target to match the proxy origin. It also forwards `X-Forwarded-Proto`, `X-Forwarded-Host`, and `X-Forwarded-Port` headers.

Supports a custom `fetch` implementation for environments with non-standard fetch.

## References

- `~/remix/packages/fetch-proxy/README.md` — full API and examples
