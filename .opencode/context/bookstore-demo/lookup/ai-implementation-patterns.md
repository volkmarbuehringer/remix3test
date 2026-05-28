<!-- Context: bookstore-demo/lookup | Priority: critical | Version: 1.2 | Updated: 2026-04-12 -->

# AI Implementation Patterns

Quick reference for AI features using OpenCode API and Vercel AI SDK.

## Routes

| Route | Purpose | Pattern |
|-------|---------|---------|
| `/assistant` | Streaming chat with history | `streamText` + messages |
| `/agent` | Tool-calling agent | `ToolLoopAgent` |
| `/aisearch` | AI book search | `generateText` |

## Pattern 1: streamText with Messages Array

**Uses `messages` array instead of `prompt`** for conversation context:

```typescript
// Build messages from conversation history
let messages: Array<{ role: 'user' | 'assistant'; content: Array<{ type: 'text'; text: string }> }> = []

if (existingChat) {
  for (let msg of existingChat.conversation) {
    messages.push({ role: 'user', content: [{ type: 'text', text: msg.user }] })
    if (msg.assistant) {
      messages.push({ role: 'assistant', content: [{ type: 'text', text: msg.assistant }] })
    }
  }
}
messages.push({ role: 'user', content: [{ type: 'text', text: message }] })

let result = streamText({
  model: provider.chatModel('minimax-m2.7'),  // Returns model object
  maxOutputTokens: 1024,
  system: SYSTEM_PROMPT,
  messages,  // Array of {role, content} objects
  abortSignal: abortController.signal,
})

// Collect streaming response
for await (let chunk of result.textStream) {
  responseText += chunk
}
```

**Key differences from `prompt`:**
- `messages` is an array of role+content objects (not a plain string)
- Enables conversation history for LLM context
- Each message has `{ role: 'user'|'assistant', content: [{ type: 'text', text: '...' }] }`

## Pattern 2: ToolLoopAgent (Tools)

```typescript
const tools = {
  get_weather: tool({ inputSchema: z.object({ location: z.string() }), execute: async ({ location }) => { ... } }),
  search_books: tool({ inputSchema: z.object({ query: z.string() }), execute: async ({ query }) => { ... } }),
}

const agent = new ToolLoopAgent({
  model: provider.chatModel('minimax-m2.7'),
  tools,
  stopWhen: stepCountIs(10),
})
```

## Pattern 3: Tool Definition (inputSchema)

```typescript
const tools = {
  get_weather: tool({
    description: 'Get weather for a location',
    inputSchema: z.object({ location: z.string().min(1).max(30) }),
    execute: async ({ location }) => { ... },
  }),
}
```

## API Configuration

| Property | Value |
|----------|-------|
| Provider | `createOpenAICompatible` |
| Base URL | `https://opencode.ai/zen/go/v1` |
| Model | `minimax-m2.7` |
| ID Generation | `generateId()` from 'ai' for string IDs |

## Related

- `lookup/ai-tool-patterns.md` - Tool definition, validation, DB access
- `../development/ai/guides/agent-toolloop-pattern.md` - Complete agent pattern with conversation
- [chat-conversation-tracking.md](../concepts/chat-conversation-tracking.md) - Conversation tracking with string IDs
- [agent-vs-chat-patterns.md](./agent-vs-chat-patterns.md) - Agent vs Chat comparison
