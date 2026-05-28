<!-- Context: sse/core/lookup/sse-client-usage | Priority: high | Version: 1.0 | Updated: 2026-03-22 -->

# SSE Client Usage

Complete client-side EventSource example for SSE.

## Basic Setup

```typescript
let eventSource = new EventSource(`/messages?room=${room}&username=${username}`)

eventSource.addEventListener('users', ({ data }) => {
  let { users } = JSON.parse(data)
  userListElement.innerHTML = users.map((u) => `<li>${u}</li>`).join('')
})

eventSource.addEventListener('status', ({ data }) => {
  let { message } = JSON.parse(data)
  showToast(message, 'info')
})

eventSource.addEventListener('broadcast', ({ data }) => {
  let { from, message, timestamp } = JSON.parse(data)
  addChatMessage({ from, message, timestamp })
})

eventSource.addEventListener('direct', ({ data }) => {
  let { from, message } = JSON.parse(data)
  showDMModal(from, message)
})
```

## Cleanup

```typescript
// Cleanup on page leave
window.addEventListener('beforeunload', () => eventSource.close())

// Or with explicit leave
async function leaveRoom() {
  await fetch('/leave', {
    method: 'POST',
    body: JSON.stringify({ room, username }),
  })
  eventSource.close()
  window.location.href = '/'
}
```

## Error Handling

```typescript
eventSource.onerror = (error) => {
  console.error('SSE error:', error)
  // EventSource auto-reconnects by default
}

eventSource.onopen = () => {
  console.log('SSE connected')
}
```

## AbortController Integration

```typescript
let abortController = new AbortController()

// Use with fetch
fetch('/messages', { signal: abortController.signal })

// Abort on cleanup
window.addEventListener('beforeunload', () => {
  abortController.abort()
})
```

## 📂 Codebase References

**Full Implementation**: `demos/sse/app/assets/message-stream.tsx` - Complete EventSource client with error handling
