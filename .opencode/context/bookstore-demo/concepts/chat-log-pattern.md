<!-- Context: bookstore-demo/concepts | Priority: high | Version: 1.0 | Updated: 2026-04-11 -->

# Client-Side Chat Log Pattern

**Core Idea**: A browser-memory chat interface using `clientEntry()` with local state, fetch API for server communication, and ARIA live regions for accessibility. No database storage—conversation exists only in browser memory.

---

## Key Points

- **State management**: Plain JS variables (`let`) in closure, updated via `handle.update()`
- **Server communication**: Fetch API with POST to controller action returning JSON
- **ARIA accessibility**: `role="log"`, `aria-live="polite"`, `aria-label` for screen readers
- **Visual feedback**: Color-coded messages (user=blue, assistant=green, error=red)
- **Message history**: Array maintained in component closure with automatic trimming (last 50)

---

## Quick Example

```tsx
export const Chat = clientEntry(url, (handle: Handle) => {
  let messages: Message[] = []
  let isLoading = false

  async function handleSubmit(event: Event, signal: AbortSignal) {
    event.preventDefault()
    let form = event.currentTarget as HTMLFormElement
    let formData = new FormData(form)

    // Add user message
    messages.push({ role: 'user', content: formData.get('message') })
    form.reset()
    isLoading = true
    handle.update()

    // Send to server
    let response = await fetch(actionUrl, {
      method: 'POST',
      body: formData,
      signal,
    })

    let data = await response.json()
    messages.push({ role: 'assistant', content: data.response })
    isLoading = false
    handle.update()
  }

  return () => (
    <ul role="log" aria-live="polite" aria-label="Chat messages">
      {messages.map(msg => <li key={msg.id}>{msg.content}</li>)}
    </ul>
  )
})
```

---

## Codebase References

**Implementation**:
- `bookstore/app/assets/assistant-chat.tsx` - Full chat component with ARIA, loading states, error handling
- `bookstore/app/controllers/assistant/controller.tsx` - Controller returning JSON responses
- `bookstore/app/controllers/assistant/page.tsx` - Page returning render function

---

## Related

- `lookup/ai-implementation-patterns.md` - AI patterns and streaming
- `guides/ai-retry-patterns.md` - Retry with exponential backoff
- `../development/remix3/guides/client-component-accessibility.md` - ARIA patterns
- `examples/ai-book-search-ui.md` - Complete UI example
