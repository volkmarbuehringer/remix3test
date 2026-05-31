<!-- Context: sse/core/lookup/health-endpoint | Priority: medium | Version: 1.0 | Updated: 2026-03-22 -->

# Health Endpoint Reference

`GET /health` returns server metrics for monitoring and debugging.

## Endpoint

```
GET /health
Content-Type: application/json
```

## Response Schema

```typescript
interface HealthResponse {
  status: 'ok'
  uptime: number // Seconds since server start
  clients: number // Active SSE connections
  rooms: number // Unique rooms with clients
  rateLimitMapSize: number // Rate limit entries in memory
  metrics: {
    messagesBroadcastTotal: number // Total messages sent
    messagesRateLimitedTotal: number // Messages rejected by rate limit
    connectionsTotal: number // Total connections since start
  }
}
```

## Example Response

```json
{
  "status": "ok",
  "uptime": 3600,
  "clients": 12,
  "rooms": 3,
  "rateLimitMapSize": 5,
  "metrics": {
    "messagesBroadcastTotal": 1042,
    "messagesRateLimitedTotal": 23,
    "connectionsTotal": 45
  }
}
```

## Usage

### Curl

```bash
curl http://localhost:44100/health
```

### Fetch

```typescript
let res = await fetch('/health')
let health = await res.json()

if (health.status === 'ok') {
  console.log(`${health.clients} active clients`)
}
```

### Monitoring

Use health endpoint for:

- **Load balancer checks**: Healthy if status === 'ok'
- **Auto-scaling**: Scale based on client count
- **Capacity planning**: Track connections over time
- **Debugging**: Rate limit hit rate

## Metrics Explained

| Metric                     | Meaning                                       |
| -------------------------- | --------------------------------------------- |
| `uptime`                   | Server running time in seconds                |
| `clients`                  | Currently connected SSE clients               |
| `rooms`                    | Rooms with at least one client                |
| `rateLimitMapSize`         | Rate limit entries (normally small)           |
| `messagesBroadcastTotal`   | Successful message deliveries                 |
| `messagesRateLimitedTotal` | Rejected messages (rate limit working)        |
| `connectionsTotal`         | Cumulative connections (includes disconnects) |

## Health vs Readiness

| Check     | Endpoint        | Purpose                    |
| --------- | --------------- | -------------------------- |
| Health    | `/health`       | Is server responding?      |
| Readiness | `/users?room=X` | Can server accept clients? |

## 📂 Codebase References

**Health Handler**: `demos/sse/app/router.tsx` - Lines 542-544
**Metrics Tracking**: `demos/sse/app/router.tsx` - Lines 29-37, 39-51
**Tests**: `demos/sse/app/router.test.ts` - Health endpoint tests
