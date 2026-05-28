<!-- Context: development/ai/guides/agent-toolloop-pattern | Priority: high | Version: 1.0 | Updated: 2026-04-13 -->

# ToolLoopAgent Pattern

Complete pattern for implementing a tool-calling agent with conversation persistence.

## Key Components

| Component | Purpose |
|-----------|---------|
| `ToolLoopAgent` | Agent that calls tools iteratively |
| `tool()` | Helper for defining tools with input schemas |
| `stepCountIs(n)` | Stop after n tool calls |
| `AsyncLocalStorage` | Request-scoped DB access |

## Full Controller Pattern

```typescript
import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import { ToolLoopAgent, tool, stepCountIs } from 'ai'
import { createConversation, appendMessage, getConversation } from '../../lib/chatlog.ts'

// 1. Define tools
const tools = {
  get_weather: tool({
    description: 'Get current weather for a location',
    inputSchema: z.object({
      location: z.string().min(1).max(30).describe('City name (max 30 chars)'),
    }),
    execute: async ({ location }) => {
      let weather = await fetchWeather(location)
      return weather
    },
  }),
}

// 2. Create agent at module level
const agent = new ToolLoopAgent({
  model: provider.chatModel('minimax-m2.7'),
  tools,
  stopWhen: stepCountIs(10),
  instructions: 'You are a helpful AI assistant with access to tools.',
})

// 3. Controller actions
export default {
  actions: {
    // SSR: Load history from DB
    async index({ url }) {
      let agentId = url.searchParams.get('agentId')
      let messages: Array<{ user: string; assistant: string }> = []

      if (agentId && /^[a-zA-Z0-9_-]+$/.test(agentId)) {
        let chat = await getConversation(agentId).catch(() => null)
        if (chat) messages = chat.conversation
      }

      return render(<AgentChatPage messages={messages} />)
    },

    // Action: Process message with conversation context
    async action({ get, url }) {
      let formData = get(FormData)

      // Validate + extract conversationId
      let rawId = url.searchParams.get('agentId') ?? formData.get('conversationId')?.toString() ?? null
      let conversationId: string | null = null
      if (rawId && /^[a-zA-Z0-9_-]+$/.test(rawId)) {
        conversationId = rawId
      }

      // Create or get conversation
      let chatId = conversationId
        ? conversationId
        : await createConversation()

      // Build messages array from history
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

      // Generate with full context
      let result = await agent.generate({ messages, abortSignal: controller.signal })

      // Save exchange
      await appendMessage(chatId, { user: message, assistant: responseText })

      return Response.json({ response: responseText, conversationId: chatId })
    },
  },
}
```

## AsyncLocalStorage for Request-Scoped DB

```typescript
const requestStorage = new AsyncLocalStorage<{ db: InstanceType<typeof Database> }>()

async function action({ get }) {
  let result = await requestStorage.run({ db: get(Database) }, () =>
    agent.generate({ messages, abortSignal: controller.signal })
  )
}
```

## Tool with Nested LLM Call

For tools that use `generateText` internally:

```typescript
let result = await provider.chatModel('minimax-m2.7').doGenerate({
  prompt: [{ type: 'text', text: systemPrompt }],
})
```

Or use `generateText`:
```typescript
let result = await generateText({
  model: provider.chatModel('minimax-m2.7'),
  prompt: systemPrompt,
  temperature: 0.3,
})
```

## Validation Regex

Always validate conversation IDs:

```typescript
if (rawId && !/^[a-zA-Z0-9_-]+$/.test(rawId)) {
  console.warn('[Agent] invalid conversationId format:', rawId)
  rawId = null
}
```

## Related

- `../lookup/agent-vs-chat-patterns.md` - Agent vs Chat comparison
- `ai-agent-tools.md` - Tool definition examples
- `per-tool-timeouts.md` - Timeout patterns
