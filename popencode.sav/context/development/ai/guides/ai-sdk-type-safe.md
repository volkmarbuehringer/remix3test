<!-- Context: development/ai/guides/ai-sdk-type-safe | Priority: high | Version: 1.0 | Updated: 2026-04-19 -->

# Type-Safe AI SDK Agents

**Purpose**: Build end-to-end type-safe agents with InferAgentUIMessage.

## Structure

```
lib/
├── agents/
│   └── my-agent.ts      # Agent + type export
└── tools/
    └── weather-tool.ts  # Tool definitions
```

## Define Tools

```typescript
import { tool } from 'ai'
import { z } from 'zod'

export const weatherTool = tool({
  description: 'Get current weather',
  inputSchema: z.object({
    location: z.string().describe('City name'),
  }),
  execute: async ({ location }) => ({
    temperature: 72,
    condition: 'sunny',
    location,
  }),
})
```

## Define Agent + Export Type

```typescript
import { ToolLoopAgent, InferAgentUIMessage } from 'ai'
import { weatherTool } from '../tools/weather-tool'

export const myAgent = new ToolLoopAgent({
  model: 'anthropic/claude-sonnet-4',
  instructions: 'You are a helpful assistant.',
  tools: { weather: weatherTool },
})

export type MyAgentUIMessage = InferAgentUIMessage<typeof myAgent>
```

## Use with useChat

```typescript
import { useChat } from '@ai-sdk/react'
import type { MyAgentUIMessage } from '@/lib/agents/my-agent'

export function Chat() {
  const { messages } = useChat<MyAgentUIMessage>()

  return (
    <div>
      {messages.map(message => (
        <Message key={message.id} message={message} />
      ))}
    </div>
  )
}
```

## Typed Tool Rendering

```typescript
function Message({ message }: { message: MyAgentUIMessage }) {
  return (
    <div>
      {message.parts.map((part, i) => {
        switch (part.type) {
          case 'text':
            return <p key={i}>{part.text}</p>
          case 'tool-weather':
            if (part.state === 'output-available') {
              return (
                <div key={i}>
                  {part.input.location}: {part.output.temperature}F
                </div>
              )
            }
            return <div key={i}>Loading...</div>
        }
      })}
    </div>
  )
}
```

## Split Tool Rendering

```typescript
// lib/tools/weather-tool.ts
import { UIToolInvocation } from 'ai'
export type WeatherToolInvocation = UIToolInvocation<typeof weatherTool>
```

```tsx
// components/weather-tool.tsx
import type { WeatherToolInvocation } from '@/lib/tools/weather-tool'

export function WeatherToolComponent({ invocation }: { invocation: WeatherToolInvocation }) {
  if (invocation.state === 'output-available') {
    return <div>{invocation.input.location}: {invocation.output.temperature}F</div>
  }
  return <div>Loading...</div>
}
```

## Resources

- Reference: `node_modules/ai/docs/`

## Related

- `../concepts/ai-sdk-overview.md` - Overview
- `../errors/ai-sdk-common-errors.md` - Common errors