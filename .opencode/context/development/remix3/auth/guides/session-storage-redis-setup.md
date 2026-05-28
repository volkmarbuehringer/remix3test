---
title: Redis Session Storage Setup
category: guides
type: context
source: /home/lucky/remix/packages/session-storage-redis/src/index.ts
tags: [remix3, guides, setup, session, redis]
---

# Redis Session Storage Setup

## Core Concept
Step-by-step guide to configure Remix's session storage with Redis. Covers Sentinel support and key prefixing.

## Steps

### 1. Install Package
```bash
npm i remix ioredis
```

### 2. Configure Redis Connection
```ts
import { createRedisSessionStorage } from 'remix/session-storage-redis'
import Redis from 'ioredis'

// Standalone Redis
const client = new Redis({
  host: 'localhost',
  port: 6379,
  password: process.env.REDIS_PASSWORD,
})

// Or Redis Sentinel
// const client = new Redis({
//   sentinels: [{ host: 'localhost', port: 26379 }],
//   name: 'mymaster',
// })

export const sessionStorage = createRedisSessionStorage({
  client,
  prefix: 'remix:session:',
  ttl: 86400, // 24 hours
})
```

### 3. Integrate with Session Middleware
```ts
import { session } from 'remix/session-middleware'

app.use(session({ storage: sessionStorage }))
```

### 4. Session Renewal on Activity
```ts
// Auto-renew session on activity
app.use(session({
  storage: sessionStorage,
  autoRenew: true,
}))
```

## Reference
- [ioredis Package](https://github.com/luin/ioredis)
