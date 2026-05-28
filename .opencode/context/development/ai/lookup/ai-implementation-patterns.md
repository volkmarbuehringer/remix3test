<!-- Context: development/ai/lookup | Priority: critical | Version: 1.1 | Updated: 2026-04-12 -->

# AI Implementation Patterns

Quick reference for AI features using OpenCode API and Vercel AI SDK.

---

## Routes

| Route | Purpose | Pattern |
|-------|---------|---------|
| `/assistant` | Streaming chat with history | `streamText` + messages |
| `/agent` | Tool-calling agent | `ToolLoopAgent` |
| `/aisearch` | AI book search | `generateText` |

---

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

---

## Pattern 2: ToolLoopAgent (Tools)

```typescript
import { ToolLoopAgent, tool, stepCountIs } from 'ai'

const tools = {
  get_weather: tool({
    inputSchema: z.object({ location: z.string() }),
    execute: async ({ location }) => { ... },
  }),
}

const agent = new ToolLoopAgent({
  model: provider.chatModel('minimax-m2.7'),
  tools,
  stopWhen: stepCountIs(10),
})

let result = await agent.generate({ messages: [{ role: 'user', content: [{ type: 'text', text: message }] }] })
```

---

## Pattern 3: Tool Definition (inputSchema)

```typescript
import { tool } from 'ai'
import { z } from 'zod'

const tools = {
  get_weather: tool({
    description: 'Get weather for a location',
    inputSchema: z.object({
      location: z.string().min(1).max(30).describe('City name'),
    }),
    execute: async ({ location }) => { ... },
  }),
}
```

---

## Pattern 4: Database Access in Tools

```typescript
// 1. Closure variable
let dbInstance: Database | null = null

// 2. Set before agent.generate()
dbInstance = get(Database)

// 3. Access in tool
execute: async ({ query }) => {
  if (!dbInstance) throw new Error('DB not available')
  return await dbInstance.findMany(books, { where: { in_stock: true } })
}
```

---

## Pattern 5: Tool Result Extraction

```typescript
if (result.steps) {
  for (let step of result.steps) {
    let stepToolResults = (step as any).toolResults
    if (stepToolResults) {
      for (let toolResult of stepToolResults) {
        // Access: toolResult.toolName, toolResult.input
      }
    }
  }
}
```

---

## Pattern 6: String ID Generation

For chatlog/conversation tracking, use `generateId()` from 'ai' instead of auto-increment:

```typescript
import { generateId } from 'ai'

// Create conversation with string ID
let id = generateId()
// Result: "clvf9s7ig00010874ei2jb4t7" (nanoid-style)

await db.exec(sql`
  INSERT INTO chatlog (id, conversation, created_at, updated_at)
  VALUES (${id}, '[]', ${now}, ${now})
`)
```

---

## API Configuration

| Property | Value |
|----------|-------|
| Provider | `createOpenAICompatible` |
| Base URL | `https://opencode.ai/zen/go/v1` |
| Model | `minimax-m2.7` |

---

## Shared Provider Utility

The bookstore uses `bookstore/app/utils/ai-provider.ts` to create a singleton provider and model with DevTools middleware:

```typescript
import { getModel } from '~/utils/ai-provider'

// In your code:
const model = getModel()  // Returns wrapped model with devToolsMiddleware
```

**Benefits**:
- Single provider instance (no re-initialization on each request)
- DevTools middleware automatically captures all AI calls
- Environment validation at first use

---

## Related

- `../guides/ai-retry-patterns.md` - Retry logic
- `../guides/per-tool-timeouts.md` - Timeouts
- `../guides/vercel-ai-sdk-agent.md` - AI SDK agent guide
- `../../bookstore-demo/concepts/chat-conversation-tracking.md` - Chat with string IDs
