---
title: Bookstore Demo
category: examples
type: context
source: /home/lucky/remix/demos/bookstore
tags: [remix3, examples, demo, crud, auth]
---

# Bookstore Demo

## Core Concept
Full Remix 3 demo implementing a bookstore with CRUD, pagination, and session auth. Uses web-standard APIs with no React dependency.

## Key Points
- Implements data-table patterns for book listings
- Uses form-data-middleware for checkout flows
- Integrates session-middleware for user auth
- Includes admin and customer user roles
- Uses controller pattern for organized route handlers

## Example
```ts
// server.ts - Bookstore setup
import { createRequestListener } from 'remix/node-fetch-server'
import { createBookstoreRouter } from './app/router.ts'
import { initializeBookstoreDatabase } from './app/data/setup.ts'

await initializeBookstoreDatabase()
const router = createBookstoreRouter()
const server = http.createServer(createRequestListener(router.fetch))
```

## Reference
- [Bookstore Demo Source](https://github.com/remix-run/remix/tree/main/demos/bookstore)
