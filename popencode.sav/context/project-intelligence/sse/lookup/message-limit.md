<!-- Context: sse/lookup/message-limit | Priority: medium | Version: 1.0 | Updated: 2026-03-22 -->

# Message Limit

Stream termination after a configurable number of messages.

## Use Cases

| Use Case          | Description                                    |
| ----------------- | ---------------------------------------------- |
| **Testing**       | Limit messages to verify stream format         |
| **Pagination**    | Stream N messages, then provide "load more"    |
| **Preview**       | Show first N messages, require action for more |
| **Rate limiting** | Prevent unlimited streaming                    |

## Implementation

### Schema Definition

```typescript
import * as s from 'remix/data-schema'
import * as f from 'remix/data-schema/form-data'
import * as coerce from 'remix/data-schema/coerce'

const messageLimitSchema = f.object({
  limit: f.field(s.optional(coerce.number())),
})
```

### Extract Limit from URL

```typescript
function getMessageLimit(url: URL): number | null {
  let result = s.parseSafe(messageLimitSchema, url.searchParams)

  if (!result.success || !result.value.limit) {
    return null
  }

  return result.value.limit
}
```

### Apply Limit in Stream

```typescript
router.map({
  messages(context) {
    let limit = getMessageLimit(context.url)

    let stream = new ReadableStream({
      start(controller) {
        let messageCount = 0

        let interval = setInterval(() => {
          try {
            messageCount++

            // Send message
            controller.enqueue(
              new TextEncoder().encode(`event: status\ndata: ${JSON.stringify({ timestamp })}\n\n`),
            )

            // Check limit and close if reached
            if (limit && messageCount >= limit) {
              clearInterval(interval)
              controller.close()
              connectedClients.delete(controller)
              loggedInUsers.delete(username)
              broadcastUserList(room)
            }
          } catch (error) {
            clearInterval(interval)
            // Cleanup on error
          }
        }, intervalMs)

        // Cleanup on disconnect
        context.request.signal.addEventListener('abort', () => {
          clearInterval(interval)
        })
      },
    })

    return new Response(stream, { headers: SSE_HEADERS })
  },
})
```

## Client Usage

### Connect with Limit

```typescript
// Stream will close after 10 messages
let eventSource = new EventSource('/messages?limit=10')

eventSource.addEventListener('status', (e) => {
  let { timestamp } = JSON.parse(e.data)
  console.log('Message received:', timestamp)
})

eventSource.onerror = () => {
  // Stream closed - check if limit reached
  console.log('Stream ended')
}
```

### URL Parameters

| Parameter  | Type   | Default | Description               |
| ---------- | ------ | ------- | ------------------------- |
| `limit`    | number | null    | Max messages before close |
| `interval` | number | 60000   | Ms between messages       |

## Testing with Limits

```typescript
it('streams messages with limit', { timeout: 5000 }, async () => {
  // Use short interval for testing
  let response = await router.fetch(
    new Request('http://localhost/messages?limit=2&interval=10&room=test&username=tester'),
  )

  let reader = response.body.getReader()
  let text = ''
  let startTime = Date.now()

  while (Date.now() - startTime < 3000) {
    let { done, value } = await reader.read()
    if (done) break
    text += new TextDecoder().decode(value)

    // Stop after receiving messages
    if (text.includes('"timestamp":')) {
      break
    }
  }

  assert.ok(text.includes('event: status'))
})
```

## Stream Closure

When limit is reached:

1. **Clear interval** - Stop generating messages
2. **Close controller** - `controller.close()`
3. **Cleanup** - Remove from connectedClients, loggedInUsers
4. **Broadcast** - Update user list for room

```typescript
if (limit && messageCount >= limit) {
  clearInterval(interval)
  controller.close()
  connectedClients.delete(controller)
  loggedInUsers.delete(username)
  broadcastUserList(room)
}
```

## Rolling Window

Alternative: Keep only last N messages in memory:

```typescript
let messages: Message[] = []

// Add message
messages.push(newMessage)

// Keep only last 100
if (messages.length > 100) {
  messages = messages.slice(-100)
}
```

## Related Patterns

| Pattern           | File                                     |
| ----------------- | ---------------------------------------- |
| SSE Streaming     | `sse/core/concepts/sse-streaming.md`     |
| Room Broadcasting | `sse/core/concepts/room-broadcasting.md` |
| Testing SSE       | `sse/guides/testing-sse.md`              |

## 📂 Codebase References

**Implementation**: `demos/sse/app/router.tsx` - messages() handler
**Client**: `demos/sse/app/assets/message-stream.tsx` - MessageStream component
**Tests**: `demos/sse/app/router.test.ts` - streaming tests
