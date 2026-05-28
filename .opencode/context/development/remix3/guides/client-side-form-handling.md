<!-- Context: development/remix3/guides | Priority: high | Version: 1.0 | Updated: 2026-04-11 -->

# Client-Side Form Handling

**Purpose**: Handle form submissions client-side using `clientEntry()` with `on('submit', handler)` to prevent page reloads.

---

## Key Points

- **Prevent default**: Call `event.preventDefault()` to stop page reload
- **FormData**: Use `new FormData(form)` to collect input values
- **Fetch API**: POST to controller action returning `Response.json()`
- **AbortSignal**: Pass signal from `on()` mixin for request cancellation
- **State updates**: Update local variables, call `handle.update()` to re-render

---

## Implementation

### Page returns render function
```tsx
export function Page() {
  return () => <Layout><ChatComponent /></Layout>
}
```

### Client component with submit handler
```tsx
export const Chat = clientEntry(url, (handle) => {
  async function handleSubmit(event: Event, signal: AbortSignal) {
    event.preventDefault()
    let form = event.currentTarget as HTMLFormElement
    let formData = new FormData(form)

    let response = await fetch(actionUrl, { method: 'POST', body: formData, signal })
    let data = await response.json()
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

### Controller returns JSON
```tsx
async action({ get }) {
  let formData = get(FormData)
  return Response.json({ response: 'Result' })
}
```

---

## Related

- `../guides/form-data-handling.md` - Reading form data
- `../concepts/client-side-chat-log.md` - Chat log pattern
- `../guides/client-state-management.md` - State management
