---
title: Async Context Middleware
category: concepts
type: context
source: /home/lucky/remix/packages/async-context-middleware/src/index.ts
tags: [remix3, concepts, middleware, async, context]
---

# Async Context Middleware

## Core Concept
Middleware propagating request-scoped async context across Remix server handlers using Node.js `AsyncLocalStorage`. Eliminates manual context passing through function call chains.

## Key Points
- Built on Node.js `AsyncLocalStorage` for request-scoped state
- Automatically attaches to incoming request lifecycle
- Integrates with Remix's middleware pipeline
- Provides `getContext()` helper for accessing request state
- Type-safe context via `AsyncContextTypes` interface

## Example
```ts
import { asyncContext, getContext } from 'remix/async-context-middleware'

// Apply middleware
app.use(asyncContext())

// Access context in handlers
const ctx = getContext()
// ctx.request, ctx.response available
```

## Reference
- [Node.js AsyncLocalStorage](https://nodejs.org/api/async_context.html#class-asynclocalstorage)
- [Remix Middleware Guide](https://remix.run/docs/en/main/guides/middleware)
