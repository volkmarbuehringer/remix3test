---
title: Memcache Session Storage Setup
category: guides
type: context
source: /home/lucky/remix/packages/session-storage-memcache/src/index.ts
tags: [remix3, guides, setup, session, memcache]
---

# Memcache Session Storage Setup

## Core Concept
Step-by-step guide to configure Remix's session storage with Memcache. Covers cluster setup and session expiration.

## Steps

### 1. Install Package
```bash
npm i remix memjs
```

### 2. Configure Memcache Cluster
```ts
import { createMemcacheSessionStorage } from 'remix/session-storage-memcache'
import memjs from 'memjs'

const client = memjs.Client.create([
  'localhost:11211',
  'localhost:11212', // additional nodes
])

export const sessionStorage = createMemcacheSessionStorage({
  client,
  prefix: 'remix:', // avoid key collisions
  ttl: 86400, // 24 hours
})
```

### 3. Integrate with Session Middleware
```ts
import { session } from 'remix/session-middleware'
import { sessionStorage } from './session-storage'

app.use(session({ storage: sessionStorage }))
```

### 4. Use in Routes
```ts
export async function loader({ request }: LoaderArgs) {
  const session = await sessionStorage.getSession(request.headers.get('Cookie'))
  const userId = session.get('userId')
}
```

## Reference
- [MemJS Package](https://github.com/memcachier/memjs)
