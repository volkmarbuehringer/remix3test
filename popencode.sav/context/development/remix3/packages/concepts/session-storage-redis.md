<!-- Context: development/remix3/packages/concepts | Priority: medium | Version: 1.0 | Updated: 2026-04-02 -->

# Concept: Session Storage Redis

**Purpose**: Redis-backed session storage for Remix. Share session state across app servers through Redis.

**Key Points**:
- Uses Redis for session persistence
- Key prefix for namespace isolation
- TTL for session expiration
- Suitable for multi-server deployments
- Uses redis client for connection management

**Minimal Example**:
```ts
import { createClient } from 'redis'
import { createRedisSessionStorage } from 'remix/session-storage-redis'

let redis = createClient({ url: process.env.REDIS_URL })
await redis.connect()

let sessionStorage = createRedisSessionStorage(redis, {
  keyPrefix: 'session:',
  ttl: 60 * 60 * 24, // 1 day
})
```

**Reference**: https://github.com/remix-run/remix/tree/main/packages/session-storage-redis