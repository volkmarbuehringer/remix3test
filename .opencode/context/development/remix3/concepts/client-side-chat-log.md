<!-- Context: development/remix3/concepts | Priority: high | Version: 1.0 | Updated: 2026-04-11 -->

# Client-Side Chat Log Pattern

**Core Idea**: Browser-memory chat interface using `clientEntry()` with local state, fetch API for server communication, and ARIA live regions for accessibility.

---

## Key Points

- **State management**: Plain JS variables (`let`) in closure, updated via `handle.update()`
- **Server communication**: Fetch API with POST to controller action returning JSON
- **ARIA accessibility**: `role="log"`, `aria-live="polite"` for screen readers
- **Visual feedback**: Color-coded messages (user=blue, assistant=green, error=red)
- **Message history**: Array in component closure with trimming (last 50 messages)

---

## Quick Example

```tsx
export const Chat = clientEntry(url, (handle: Handle) => {
  let messages: Message[] = []

  async function handleSubmit(event: Event, signal: AbortSignal) {
    event.preventDefault()
    messages.push({ role: 'user', content: formData.get('message') })
    handle.update()

    let response = await fetch(actionUrl, { method: 'POST', body: formData, signal })
    let data = await response.json()
    messages.push({ role: 'assistant', content: data.response })
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

## Related

- `../guides/client-component-accessibility.md` - ARIA patterns
- `../guides/client-state-management.md` - State management
