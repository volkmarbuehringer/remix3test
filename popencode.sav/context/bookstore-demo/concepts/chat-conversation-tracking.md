<!-- Context: bookstore-demo/concepts | Priority: high | Version: 1.3 | Updated: 2026-04-12 -->

# Chat Conversation Tracking in Remix

**Core Idea**: Server-side conversation tracking with URL query parameter for persistence. Uses `chatId` in URL query (`/chat?chatId=xyz`) instead of form data. Client reads from URL on load and updates URL with `history.replaceState` after first message.

---

## Key Points

- **URL query parameter pattern**: Use `chatId` in URL (`/chat?chatId=xyz`) instead of form data
- **Controller reads from query param first**: `url.searchParams.get('chatId')` has priority over form data
- **Client reads initial from URL**: Use `new URLSearchParams(window.location.search).get('chatId')` on page load
- **URL updates after response**: Use `history.replaceState` to update URL after first message
- **Client maintains conversationId**: Store in component state (string), send as query param
- **Build conversation history**: Retrieve existing chat and build `messages` array for LLM context
- **Frame URL for updates**: Return frameUrl in JSON response for client to render

---

## Quick Example

### Controller (reads from query param first)
```ts
async action({ get, url }) {
  let formData = get(FormData)
  let message = formData.get('message')

  // Query param has priority, fallback to form data
  let conversationId = url.searchParams.get('chatId') ?? formData.get('conversationId')?.toString() ?? null

  // Create or get conversation
  let chatId: string
  if (!conversationId) {
    chatId = await createConversation()  // Creates new conversation
  } else {
    chatId = conversationId  // Uses existing
  }

  // Build messages array from conversation history
  let existingChat = await getConversation(chatId)
  let messages: Array<{ role: 'user' | 'assistant'; content: Array<{ type: 'text'; text: string }> }> = []

  if (existingChat) {
    for (let msg of existingChat.conversation) {
      messages.push({ role: 'user', content: [{ type: 'text', text: msg.user }] })
      if (msg.assistant) {
        messages.push({ role: 'assistant', content: [{ type: 'text', text: msg.assistant }] })
      }
    }
  }

  // Add current user message
  messages.push({ role: 'user', content: [{ type: 'text', text: message }] })

  // Call streamText with messages array
  let result = streamText({
    model: provider.chatModel('minimax-m2.7'),
    messages,
    system: SYSTEM_PROMPT,
  })

  // Collect response and save
  for await (let chunk of result.textStream) {
    responseText += chunk
  }
  await appendMessage(chatId, { user: message, assistant: responseText })

  return Response.json({ frameUrl, conversationId: chatId })
}
```

### Client (reads initial from URL)
```ts
let initialChatId: string | undefined = undefined
if (typeof window !== 'undefined') {
  let params = new URLSearchParams(window.location.search)
  initialChatId = params.get('chatId') ?? undefined
}
let conversationId: string | null = initialChatId ?? null
```

### Client (updates URL after response)
```ts
if (data.conversationId) {
  conversationId = data.conversationId
  let url = new URL(window.location.href)
  url.searchParams.set('chatId', data.conversationId)
  window.history.replaceState({}, '', url.toString())
}
```

---

## Codebase References

- `bookstore/app/lib/chatlog.ts` - createConversation, appendMessage, getConversation (string IDs)
- `bookstore/app/controllers/chat/controller.tsx` - Controller reads from query param first (line 61)
- `bookstore/app/assets/chat-interface.tsx` - Client reads from URL on load (lines 10-15), updates URL after response (lines 420-426)
- `bookstore/db/migrations/20260412000000_create_chatlog_table.ts` - Migration with TEXT id

---

## Related

- [jsonb-database-patterns.md](jsonb-database-patterns.md) - Database storage patterns
- [chat-log-pattern.md](chat-log-pattern.md) - Client-side UI pattern
- [admin-chatlog-routes.md](admin-chatlog-routes.md) - Admin viewing
- `lookup/ai-implementation-patterns.md` - streamText with messages array