<!-- Context: bookstore-demo/guides | Priority: high | Version: 1.1 | Updated: 2026-04-12 -->

# Admin Chatlog Routes

**Core Idea**: Admin routes use nested folder structure under `controllers/admin/` with controller.tsx and page.tsx. Include filter functionality via URL query parameters for searching conversations.

---

## Key Points

- **Folder structure**: `controllers/admin/chatlog/controller.tsx` + `page.tsx`
- **Controller exports default**: Object with `actions.index()` returning render
- **Page receives props**: Data passed from controller via render function
- **Parent links to child**: Add anchor tag in parent admin page to link to child route
- **No route config needed**: Routes discovered from file structure automatically
- **Filter via URL**: Read `?filter=` from URL query param, pass to database function

---

## Quick Example

```
controllers/admin/
├── page.tsx              # Parent admin page
├── controller.tsx        # Parent controller
├── chatlog/
│   ├── controller.tsx    # Returns render with conversations data
│   └── page.tsx          # Displays conversation list
```

```ts
// Child controller with filter
export default {
  actions: {
    async index({ url }: { url: URL }) {
      let filter = url.searchParams.get('filter') ?? undefined
      let conversations = await getAllConversations(filter)
      return render(<ChatLogPage conversations={conversations} filter={filter} />)
    },
  },
}

// Child page
export function ChatLogPage() {
  return ({ conversations, filter }) => (
    <div>
      <form method="get" action="/admin/chatlog">
        <input name="filter" defaultValue={filter} placeholder="Search..." />
        <button type="submit">Search</button>
      </form>
      <ul>
        {conversations.map(conv => (
          <li key={conv.id}>Conversation #{conv.id}</li>
        ))}
      </ul>
    </div>
  )
}
```

---

## Codebase References

- `bookstore/app/controllers/admin/page.tsx` - Parent with link to chatlog
- `bookstore/app/controllers/admin/chatlog/controller.tsx` - Admin controller
- `bookstore/app/controllers/admin/chatlog/page.tsx` - Chat log display

---

## Related

- `../development/remix3/guides/split-controllers.md` - Modular controller organization
- `../development/remix3/examples/admin-ui-migration.md` - Admin migration example
- [chat-conversation-tracking.md](chat-conversation-tracking.md) - Conversation implementation