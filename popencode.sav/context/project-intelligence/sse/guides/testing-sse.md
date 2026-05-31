<!-- Context: sse/guides/testing-sse | Priority: high | Version: 1.0 | Updated: 2026-03-22 -->

# Testing SSE

Testing strategies for Server-Sent Events with ReadableStream and AbortController.

## Core Testing Pattern

SSE streams use `ReadableStream` which requires proper async reading:

```typescript
import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

describe('SSE endpoint', () => {
  it('returns SSE content type', async () => {
    let controller = new AbortController()
    let response = await router.fetch(
      new Request('http://localhost/messages', { signal: controller.signal }),
    )

    assert.equal(response.headers.get('Content-Type'), 'text/event-stream')
    controller.abort() // Cleanup
  })
})
```

## Reading SSE Streams

Use `response.body.getReader()` to read stream chunks:

```typescript
it('streams messages', { timeout: 5000 }, async () => {
  let controller = new AbortController()
  let response = await router.fetch(
    new Request('http://localhost/messages?limit=2&interval=10', {
      signal: controller.signal,
    }),
  )

  let reader = response.body.getReader()
  let text = ''
  let startTime = Date.now()

  while (Date.now() - startTime < 3000) {
    let { done, value } = await reader.read()
    if (done) break
    text += new TextDecoder().decode(value)
    if (text.includes('"timestamp":')) {
      controller.abort()
      break
    }
  }

  reader.releaseLock()
  assert.ok(text.includes('event: status'))
})
```

## Testing Room Isolation

Verify broadcasts only reach clients in the same room:

```typescript
it('broadcasts only to same room', { timeout: 5000 }, async () => {
  // Connect two clients to different rooms
  let room1Controller = new AbortController()
  let room2Controller = new AbortController()

  let room1Response = await router.fetch(
    new Request('http://localhost/messages?interval=10&room=room1&username=user1', {
      signal: room1Controller.signal,
    }),
  )

  let room2Response = await router.fetch(
    new Request('http://localhost/messages?interval=10&room=room2&username=user2', {
      signal: room2Controller.signal,
    }),
  )

  // Broadcast to room1
  let formData = new FormData()
  formData.append('clientmessage', 'Hello Room 1!')
  formData.append('room', 'room1')
  formData.append('username', 'testuser')

  await router.fetch(new Request('http://localhost/broadcast', { method: 'POST', body: formData }))

  // Read room1 - should receive broadcast
  let room1Reader = room1Response.body.getReader()
  let room1Text = ''
  // ... read loop ...
  assert.ok(room1Text.includes('Hello Room 1!'))

  // Read room2 - should NOT receive broadcast
  let room2Reader = room2Response.body.getReader()
  let room2Text = ''
  // ... read loop ...
  assert.ok(!room2Text.includes('Hello Room 1!'))

  // Cleanup
  room1Controller.abort()
  room2Controller.abort()
})
```

## Testing Rate Limiting

```typescript
it('rate limits messages within 500ms', async () => {
  // First message succeeds, immediate second is rate limited
  let formData = new FormData()
  formData.append('clientmessage', 'First')
  formData.append('room', 'test')
  formData.append('username', 'user')

  await router.fetch(new Request('http://localhost/broadcast', { method: 'POST', body: formData }))

  formData.append('clientmessage', 'Second')
  let res2 = await router.fetch(
    new Request('http://localhost/broadcast', { method: 'POST', body: formData }),
  )
  assert.equal(res2.status, 302) // Redirect = rate limited
})

it('allows messages after rate limit expires', async () => {
  // ... first message ...
  await new Promise((resolve) => setTimeout(resolve, 600)) // Wait 500ms + buffer
  // ... second message succeeds ...
})
```

## Testing Duplicate Connections

```typescript
it('rejects second connection from same user', async () => {
  let controller1 = new AbortController()
  await router.fetch(
    new Request('http://localhost/messages?room=test&username=dupuser', {
      signal: controller1.signal,
    }),
  )

  // Second connection returns error stream
  let controller2 = new AbortController()
  let response = await router.fetch(
    new Request('http://localhost/messages?room=test&username=dupuser', {
      signal: controller2.signal,
    }),
  )

  assert.equal(response.headers.get('Content-Type'), 'text/event-stream')

  // Read error event
  let reader = response.body.getReader()
  let { value } = await reader.read()
  let text = new TextDecoder().decode(value)

  assert.ok(text.includes('event: error'))
  assert.ok(text.includes('User is already logged in'))

  controller1.abort()
  controller2.abort()
})
```

## Testing Input Sanitization

```typescript
it('sanitizes input and truncates long values', async () => {
  let controller = new AbortController()
  // Script tags stripped, long room names truncated to 50 chars
  let response = await router.fetch(
    new Request('http://localhost/messages?room=<script>alert(1)</script>&username=test', {
      signal: controller.signal,
    }),
  )

  assert.equal(response.headers.get('Content-Type'), 'text/event-stream')
  controller.abort()
})
```

## Testing Best Practices

| Practice                           | Why                          |
| ---------------------------------- | ---------------------------- |
| Always `controller.abort()`        | Prevents hanging connections |
| Use `{ timeout: X }` option        | Prevents infinite waits      |
| `reader.releaseLock()` after abort | Cleans up resources          |
| Sequential reads in separate tests | Avoid race conditions        |

## 📂 Codebase References

**Full test suite**: `demos/sse/app/router.test.ts` (569 lines, 30 tests)
**SSE endpoint**: `demos/sse/app/router.tsx` - messages() handler
