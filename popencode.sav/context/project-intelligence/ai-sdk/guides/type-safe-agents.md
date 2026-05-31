---
title: Type-Safe Agents
description: End-to-end type safety with InferAgentUIMessage.
---

# Guide: Type-Safe Agents

**Core Idea**: Build end-to-end type-safe agents by inferring `UIMessage` types from your agent definition, enabling type-safe UI rendering with `useChat`.

## Key Points

- Use `InferAgentUIMessage<typeof agent>` to get typed message type
- Tool parts become typed as `tool-{toolName}` in switch statements
- Access `part.input` and `part.output` with proper state checks
- Use `UIToolInvocation<typeof tool>` for split component pattern

## Agent Definition

```ts
// lib/agents/my-agent.ts
import { ToolLoopAgent, InferAgentUIMessage } from 'ai';
import { weatherTool } from '../tools/weather-tool';

export const myAgent = new ToolLoopAgent({
  model: 'anthropic/claude-sonnet-4',
  instructions: 'Helpful assistant',
  tools: { weather: weatherTool },
});

export type MyAgentUIMessage = InferAgentUIMessage<typeof myAgent>;
```

## useChat Consumption

```tsx
// app/chat.tsx
import { useChat } from '@ai-sdk/react';
import type { MyAgentUIMessage } from '@/lib/agents/my-agent';

export function Chat() {
  const { messages } = useChat<MyAgentUIMessage>();
  // messages are fully typed
}
```

## Type-Safe Rendering

```tsx
function Message({ message }: { message: MyAgentUIMessage }) {
  return (
    <div>
      {message.parts.map((part, i) => {
        switch (part.type) {
          case 'text':
            return <p key={i}>{part.text}</p>;
          case 'tool-weather':
            if (part.state === 'output-available') {
              return <div key={i}>{part.input.location}: {part.output.temp}F</div>;
            }
            return <div key={i}>Loading...</div>;
          default:
            return null;
        }
      })}
    </div>
  );
}
```

## State Checks Required

| Property | Required State |
|----------|---------------|
| `part.input` | `input-available` or `output-available` |
| `part.output` | `output-available` |

## Split Component Pattern

```ts
// lib/tools/weather-tool.ts
import { tool, UIToolInvocation } from 'ai';
export type WeatherInvocation = UIToolInvocation<typeof weatherTool>;
```

```tsx
// components/weather-tool.tsx
import type { WeatherInvocation } from '@/lib/tools/weather-tool';

export function WeatherTool({ invocation }: { invocation: WeatherInvocation }) {
  if (invocation.state === 'output-available') {
    return <div>{invocation.input.location}: {invocation.output.temp}F</div>;
  }
  return <div>Loading...</div>;
}
```

## Reference

- Full docs: `node_modules/ai/docs/`
- Related: [guides/building-agents.md](building-agents.md)