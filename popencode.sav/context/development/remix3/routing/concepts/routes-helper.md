---
title: Routes Helper
category: concepts
type: context
source: .tmp/external-context/remix/core-api.md
tags: [remix3, concepts, routing, routes]
---

# Routes Helper

## Core Concept
Declarative route definition helpers (`route()`, `get()`) that define URL patterns and map to controller actions. Used with `router.map()` to connect routes to handler functions.

## Key Points
- `route({})` defines nested route objects with path patterns
- `get()`, `post()`, etc. define method-specific routes
- Routes use `*` for catch-all patterns (e.g., `/assets/*path`)
- `router.map(routes, controller)` connects routes to handler object
- Controller pattern organizes handlers by action names matching route keys

## Example
```ts
import { get, route } from 'remix/routes'

export const routes = route({
  home: get('/'),
  messages: get('/messages'),
  assets: '/assets/*path',
})

router.map(routes, rootController)
```

## Reference
- Source: https://api.remix.run/
- Related: `./fetch-router.md`
