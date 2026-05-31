<!-- Context: development/remix3/guides/chat-ssr | Priority: high | Version: 1.2 | Updated: 2026-04-12 -->

# Remix 3 SSR Chat Pattern

Full conversation history via SSR with database persistence.

## Core Concept

URL-driven state with `chatId` query parameter. SSR-first: messages rendered on server. Post-submit reload to show updated conversation.

---

## Key Points

- **URL state**: `chatId` query param controls conversation
- **SSR-first**: Messages rendered server-side via controller
- **Reload pattern**: Form submit + `window.location.reload()`
- **Security**: chatId validation regex, XSS sanitization

---

## Flow

```
GET /chat              → New chat (no messages)
GET /chat?chatId=xxx  → SSR loads from DB
POST /chat            → Save, reload to show
```

---

## Minimal Example

```typescript
import type { Handle } from 'remix/ui'

// Controller
async index({ url }) {
  let chatId = url.searchParams.get('chatId')
  let messages = chatId ? await getConversation(chatId) : []
  return render(<ChatPage messages={messages} />)
}

// Page receives props
export function ChatPage(handle: Handle<{ messages: Message[] }>) {
  return () => {
    let { messages } = handle.props
    return (
      <ul>{messages.map(m => <li>{m.assistant}</li>)}</ul>
    )
  }
}
```

---

## Reference

- SSE streaming: `guides/sse-implementation.md`
- Chat controller: `bookstore/app/controllers/chat/controller.tsx`
- Database: `guides/postgresql-database.md`
