<!-- Context: bookstore-demo/guides | Priority: high | Version: 1.0 | Updated: 2026-04-11 -->

# Client-Side Form Handling in Remix

**Core Idea**: Handle form submissions client-side using `clientEntry()` with `on('submit', handler)` to prevent page reloads, send data via fetch, and update UI dynamically without server-side rendering.

---

## Key Points

- **Prevent default**: Call `event.preventDefault()` in submit handler to stop page reload
- **FormData**: Use `new FormData(form)` to collect input values
- **Fetch API**: POST to controller action that returns `Response.json()`
- **AbortSignal**: Pass signal from `on()` mixin for request cancellation
- **State updates**: Update local variables, then call `handle.update()` to re-render

---

## Implementation Steps

1. **Page returns render function** (not JSX directly):
```tsx
export function Page() {
  return () => <Layout><ChatComponent /></Layout>
}
```

2. **Client component with submit handler**:
```tsx
export const Chat = clientEntry(url, (handle) => {
  async function handleSubmit(event: Event, signal: AbortSignal) {
    event.preventDefault()
    let form = event.currentTarget as HTMLFormElement
    let formData = new FormData(form)

    let response = await fetch(actionUrl, {
      method: 'POST',
      body: formData,
      signal,
    })

    let data = await response.json()
    // Update state and re-render
    handle.update()
  }

  return () => (
    <form method="POST" action={actionUrl} mix={[on('submit', handleSubmit)]}>
      <input name="message" />
      <button type="submit">Send</button>
    </form>
  )
})
```

3. **Controller returns JSON**:
```tsx
async action({ get }) {
  let formData = get(FormData)
  // Process...
  return Response.json({ response: 'Result' })
}
```

---

## Codebase References

**Implementation**:
- `bookstore/app/assets/assistant-chat.tsx` - Complete form handling with loading states
- `bookstore/app/controllers/assistant/controller.tsx` - JSON-returning controller action
- `bookstore/app/controllers/assistant/page.tsx` - Page with render function pattern

**Related**:
- `../development/remix3/guides/form-data-handling.md` - Reading form data
- `../development/remix3/examples/form-data-patterns.md` - Correct/incorrect patterns

---

## Related

- `concepts/chat-log-pattern.md` - Chat log implementation
- `../development/remix3/guides/client-state-management.md` - State management
