<!-- Context: sse/features | Priority: critical | Version: 1.0 | Updated: 2026-03-22 -->

# SSE Demo Features

Detailed descriptions of SSE demo features and patterns.

## Core Features

### SSE Streaming

Server-Sent Events provide one-way real-time streaming from server to client over HTTP.

**Implementation**: `demos/sse/app/router.tsx` - Uses ReadableStream with `text/event-stream` content type

**Headers**:

```typescript
'Content-Type': 'text/event-stream'
'Cache-Control': 'no-cache'
Connection: 'keep-alive'
'X-Content-Type-Options': 'nosniff'
'X-Accel-Buffering': 'no'
```

### Room Broadcasting

Clients join rooms and receive broadcasts specific to their room.

**State Management**:

```typescript
let connectedClients = new Map<
  ReadableStreamDefaultController,
  { room: string; username: string }
>()
```

### Rate Limiting

Prevents message spam with per-user, per-room rate limiting.

**Configuration**: 500ms minimum between messages

**TTL Cleanup**: Stale entries cleaned every 50 seconds

### Input Sanitization

All user input is sanitized before processing:

| Input    | Max Length | Allowed Chars                        |
| -------- | ---------- | ------------------------------------ |
| Room     | 50         | `\w-`                                |
| Username | 30         | `\w`                                 |
| Message  | 1000       | strips `< > ' " &` and control chars |

### Login Tracking

Prevents duplicate sessions per username (global across all rooms).

**Check**: User must not have an active SSE connection

### Health Endpoint

`GET /health` returns server metrics:

```json
{
  "status": "ok",
  "uptime": 1234,
  "clients": 5,
  "rooms": 2,
  "rateLimitMapSize": 10,
  "metrics": { "messagesBroadcastTotal": 100, ... }
}
```

### Graceful Shutdown

Server sends `event: shutdown` to all clients before closing connections.

### E2E Testing

Comprehensive Playwright-based end-to-end tests covering UI interactions, multi-user scenarios, and real-time features.

**Test Coverage**: 46 tests across 15 categories

| Category              | Tests |
| --------------------- | ----- |
| Homepage              | 5     |
| Join Room Form        | 4     |
| Room Interaction      | 8     |
| Multiple Users        | 1     |
| Message Broadcasting  | 3     |
| Direct Messaging      | 2     |
| Encryption            | 3     |
| Encryption Edge Cases | 2     |
| Error Handling        | 3     |
| Message Limit         | 2     |
| Input Handling        | 4     |
| Accessibility         | 3     |
| Status Updates        | 2     |
| Navigation            | 2     |
| Message Sending       | 4     |

**Run tests**: `cd demos/sse && pnpm run test:e2e`

### Accessibility

WCAG 2.1 AA compliant chat interface with screen reader support and keyboard navigation.

**Implemented Features**:

- Form labels for all inputs (visible and screen-reader only)
- `role="log"` with `aria-live="polite"` for message announcements
- Enter key to send messages
- Focus management after actions
- Color contrast meeting WCAG AA standards

**Code Reference**: `demos/sse/app/assets/message-stream.tsx` (lines 765-900)

## Event Types

| Event       | Payload                                       | Purpose                      |
| ----------- | --------------------------------------------- | ---------------------------- |
| `users`     | `{ users: string[] }`                         | User list updates            |
| `status`    | `{ timestamp: string }`                       | Periodic status pings        |
| `broadcast` | `{ from, to, message, encrypted, timestamp }` | Room messages                |
| `direct`    | Same as broadcast                             | Private messages             |
| `error`     | `{ error: string }`                           | Connection errors            |
| `shutdown`  | `{ reason: string }`                          | Server shutdown notification |

## 📂 Codebase References

**Router**: `demos/sse/app/router.tsx` - All SSE handlers
**Client**: `demos/sse/app/assets/message-stream.tsx` - EventSource client
**Server**: `demos/sse/server.ts` - HTTP server
**Unit Tests**: `demos/sse/app/router.test.ts` - 30 tests
**E2E Tests**: `demos/sse/e2e/app.test.ts` - 46 tests
