---
title: Fetch Proxy
category: concepts
type: context
source: /home/lucky/remix/packages/fetch-proxy/src/index.ts
tags: [remix3, concepts, fetch, proxy, api]
---

# Fetch Proxy

## Core Concept
Utility for proxying fetch requests through Remix server handlers. Supports request/response transformation and header forwarding to upstream APIs.

## Key Points
- Forwards client fetch requests to upstream APIs
- Adds server-side auth headers automatically
- Handles response caching with configurable TTL
- Supports request/response transformation pipeline
- Integrates with Remix's fetch router

## Example
```ts
import { createFetchProxy } from 'remix/fetch-proxy'

const proxy = createFetchProxy('https://upstream-api.com', {
  headers: { Authorization: `Bearer ${process.env.API_TOKEN}` }
})

app.use('/api/proxy', proxy)
```

## Reference
- [Fetch API MDN](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API)
