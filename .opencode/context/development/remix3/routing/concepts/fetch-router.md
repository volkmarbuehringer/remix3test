---
title: Fetch Router
category: concepts
type: context
source: /home/lucky/remix/packages/fetch-router/src/index.ts
tags: [remix3, concepts, routing, fetch, api]
---

# Fetch Router

## Core Concept
Lightweight router for Remix server-side fetch request handling. Maps HTTP methods and paths to handler functions with middleware support.

## Key Points
- Supports GET, POST, PUT, DELETE, PATCH methods
- Integrates with Remix's middleware pipeline
- Returns 405 for unsupported methods
- Provides request context with params and query
- Supports controller pattern for organized handlers

## Example
```ts
import { createRouter } from 'remix/fetch-router'

const router = createRouter()
router.get('/api/users', (req) => new Response('Users'))
router.post('/api/users', async (req) => {
  const data = await req.json()
  return new Response('Created')
})
```

## Reference

- Packages: `~/remix/packages/fetch-router/README.md`
