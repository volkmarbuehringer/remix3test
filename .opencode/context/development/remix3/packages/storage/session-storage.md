<!-- Context: development/remix3/packages/storage | Priority: medium | Version: 1.0 | Updated: 2026-04-25 -->

# session-storage

Backend implementations for session storage.

| Package | Backend | Use Case |
|---------|---------|----------|
| `session-storage-memcache` | Memcache | Distributed sessions, production |
| `session-storage-redis` | Redis | Distributed sessions, production |

## Usage

```ts
import { createMemcacheSessionStorage } from 'remix/session-storage-memcache'
import { createRedisSessionStorage } from 'remix/session-storage-redis'

// Memcache
let storage = createMemcacheSessionStorage({
  cookie,
  clients: ['memcached:11211'],
})

// Redis
let storage = createRedisSessionStorage({
  cookie,
  client: redisClient,
})
```

## Reference

`/home/lucky/remix/packages/session-storage-memcache/README.md`
`/home/lucky/remix/packages/session-storage-redis/README.md`