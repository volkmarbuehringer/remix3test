<!-- Context: bookstore-demo/lookup | Priority: high | Version: 1.1 | Updated: 2026-04-14 -->

# Agent vs Chat Patterns

Comparison between `/agent` (ToolLoopAgent) and `/chat` (streamText) implementations.

## At a Glance

| Feature | Agent (`/agent`) | Chat (`/chat`) |
|---------|------------------|----------------|
| Route | `/agent` | `/chat` |
| LLM API | `ToolLoopAgent.generate()` | `streamText()` |
| Tools | Yes (weather, search, etc.) | No |
| Streaming | No (blocking) | Yes (SSE) |
| History | Yes (injected into messages) | Yes (injected into messages) |
| URL Param | `?agentId=` | `?chatId=` |

## Visual Differentiation in Admin Chatlog

**Pattern**: Conditionally route to `/agent` or `/chat` based on toolCalls presence:

```typescript
// In admin/chatlog/page.tsx - detect if conversation used tools
let hasTools = conv.conversation.some((msg) => msg.toolCalls && msg.toolCalls.length > 0)
let route = hasTools ? routes.agent.index : routes.chat.index

// Build URL with appropriate param
let urlParam = hasTools ? 'agentId' : 'chatId'
let href = `${route.href()}?${urlParam}=${conv.id}`
```

**Badge UI**: Orange for Agent, Green for Chat:

```tsx
<span style={{
  marginLeft: '0.5rem',
  padding: '0.125rem 0.5rem',
  fontSize: '0.75rem',
  fontWeight: 600,
  borderRadius: '4px',
  backgroundColor: hasTools ? '#e65100' : '#4caf50',
  color: '#fff',
}}>
  {hasTools ? 'Agent' : 'Chat'}
</span>
```

## When to Use

### Use Agent When:
- Need tool calling (weather, search, database access)
- Multi-step reasoning required
- LLM should decide when to call tools

### Use Chat When:
- Simple question/answer
- Streaming responses needed
- Faster response for simple queries

## Shared Patterns

Both implementations share these patterns:

### 1. Conversation ID Validation

```typescript
let rawId = url.searchParams.get('agentId') ?? formData.get('conversationId')?.toString() ?? null
let conversationId: string | null = null
if (rawId && /^[a-zA-Z0-9_-]+$/.test(rawId)) {
  conversationId = rawId
}
```

### 2. Build Messages from History

```typescript
let existingChat = await getConversation(chatId)
let messages: Array<{ role: 'user' | 'assistant'; content: [{ type: 'text'; text: string }] }> = []

if (existingChat) {
  for (let msg of existingChat.conversation) {
    messages.push({ role: 'user', content: [{ type: 'text', text: msg.user }] })
    if (msg.assistant) {
      messages.push({ role: 'assistant', content: [{ type: 'text', text: msg.assistant }] })
    }
  }
}
messages.push({ role: 'user', content: [{ type: 'text', text: message }] })
```

### 3. Save Exchange

```typescript
await appendMessage(chatId, { user: message, assistant: responseText })
```

### 4. SSR with Query Params

```typescript
async index({ url }) {
  let agentId = url.searchParams.get('agentId')
  let messages: Array<{ user: string; assistant: string }> = []

  if (agentId && /^[a-zA-Z0-9_-]+$/.test(agentId)) {
    let chat = await getConversation(agentId).catch(() => null)
    if (chat) messages = chat.conversation
  }

  return render(<ChatPage messages={messages} />)
}
```

## Message Format Comparison

### Agent (ToolLoopAgent)
```typescript
agent.generate({
  messages: [{ role: 'user', content: [{ type: 'text', text: message }] }],
  abortSignal: controller.signal,
})
```

### Chat (streamText)
```typescript
streamText({
  model: provider.chatModel('minimax-m2.7'),
  system: SYSTEM_PROMPT,
  messages: [
    { role: 'user', content: [{ type: 'text', text: message }] },
  ],
})
```

## File Locations

| File | Agent | Chat |
|------|-------|------|
| Controller | `app/controllers/agent/controller.tsx` | `app/controllers/chat/controller.tsx` |
| Page | `app/controllers/agent/page.tsx` | `app/controllers/chat/page.tsx` |
| Client Component | `app/assets/agent-chat.tsx` | `app/assets/chat-interface.tsx` |

## Potential Refactoring

Extract shared utilities into `app/lib/chat-controller.ts`:

```typescript
export function validateConversationId(url: URL, formData: FormData, paramName: string): string | null
export async function createOrGetConversation(id: string | null): Promise<string>
export async function buildMessageHistory(conversationId: string): Promise<Message[]>
export function createChatResponse(data: ResponseData): Response
```

## Related

- `../development/ai/guides/agent-toolloop-pattern.md` - Full agent pattern
- `ai-implementation-patterns.md` - AI SDK patterns
- `chat-conversation-tracking.md` - Conversation tracking concept
