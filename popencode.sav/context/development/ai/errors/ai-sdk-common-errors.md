<!-- Context: development/ai/errors/ai-sdk-common-errors | Priority: critical | Version: 1.0 | Updated: 2026-04-19 -->

# AI SDK Common Errors

**Core Idea**: Common AI SDK type errors and deprecated APIs with correct replacements.

## Deprecated APIs (v5 → v6)

| Old (v5 Don't Use) | Use Instead (v6) |
|----------------|------------|
| `maxTokens` | `maxOutputTokens` |
| `maxSteps` | `stopWhen: isStepCount(n)` |
| `parameters` | `inputSchema` |
| `generateObject` | **Removed in v6** - return tool results instead |
| `toDataStreamResponse()` | `toUIMessageStreamResponse()` |
| `addToolResult` | `addToolOutput` |
| `messages` (in createAgentUIStreamResponse) | `uiMessages` |
| `useChat({ api: '/path' })` | `useChat({ transport: new DefaultChatTransport({ api: '/path' }) })` |

## v6 Removed APIs

The following APIs were **removed in AI SDK v6** and no longer exist:

- `generateObject` - Use tools with structured output instead
- `v4` (coerce) - Use `inputSchema` directly
- `createAI()` - Use providers directly

## Output Options

```typescript
import { generateText, Output } from 'ai'

// Structured object
Output.object({ schema: z.object({ ... }) })

// Array of items
Output.array({ element: z.object({ ... }) })

// Choice from options
Output.choice({ options: ['a', 'b'] as const })

// Untyped JSON
Output.json()
```

## useChat Breaking Changes

```typescript
// ❌ Old - deprecated
const { input, handleInputChange, handleSubmit } = useChat({
  api: '/api/chat',
})

// ✅ New - manual state management
const [input, setInput] = useState('')
const { sendMessage } = useChat({
  transport: new DefaultChatTransport({ api: '/api/chat' }),
})
const handleSubmit = e => {
  e.preventDefault()
  sendMessage({ text: input })
  setInput('')
}
```

## Tool Part Changes

```typescript
// Old → New
tool-invocation → tool-{toolName}
part.args → part.input
part.result → part.output

// States renamed
'partial-call' → 'input-streaming'
'call' → 'input-available'
'result' → 'output-available'
```

## State-Dependent Access

```typescript
// Input only available in these states
part.state === 'input-available' || part.state === 'output-available'

// Output only available after execution
part.state === 'output-available'
```

## Resources

- Reference: `node_modules/ai/docs/`
- Full list: https://ai-sdk.dev

## Related

- `../concepts/ai-sdk-overview.md` - Overview
- `../guides/ai-sdk-type-safe.md` - Type safety patterns