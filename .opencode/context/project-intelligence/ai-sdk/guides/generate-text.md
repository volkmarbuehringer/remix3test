---
title: generateText
description: Core API for text generation with tool calling.
---

# Guide: generateText

**Core Idea**: `generateText` is the core AI SDK function for non-interactive text generation with optional tool calling. Use for automation, drafting, summarization, and agents.

## Key Points

- **Returns**: `{ text, toolCalls, toolResults, finishReason, usage }`
- **Parameters**: `model`, `prompt` (or `messages`), `system`, `tools`, `output`
- **Tool execution**: Auto-executes when `execute` is defined in tool
- **Structured output**: Use `output: Output.object({ schema: ... })` instead of `generateObject`
- **Message types**: `UserModelMessage`, `AssistantModelMessage`, `ToolModelMessage`

## Quick Example

```ts
import { generateText } from 'ai';
import { gateway } from 'ai';

const { text } = await generateText({
  model: gateway('anthropic/claude-sonnet-4.5'),
  prompt: 'Write a haiku about coding',
});

console.log(text);
```

## With Tools

```ts
import { generateText, tool } from 'ai';
import { gateway } from 'ai';
import { z } from 'zod';

const { text, toolCalls } = await generateText({
  model: gateway('anthropic/claude-sonnet-4.5'),
  prompt: 'What is the weather in Tokyo?',
  tools: {
    weather: tool({
      description: 'Get weather for a location',
      inputSchema: z.object({ location: z.string() }),
      execute: async ({ location }) => ({ temp: 22, conditions: 'sunny' }),
    }),
  },
});

console.log(text); // Final answer after tool execution
```

## Structured Output

```ts
import { generateText, Output } from 'ai';
import { z } from 'zod';

const result = await generateText({
  model: gateway('anthropic/claude-sonnet-4.5'),
  prompt: 'Extract the recipe from this text...',
  output: Output.object({
    schema: z.object({
      name: z.string(),
      ingredients: z.array(z.string()),
    }),
  }),
});

console.log(result.output); // { name: '...', ingredients: [...] }
```

## Options

| Option | Type | Description |
|--------|------|-------------|
| `maxOutputTokens` | number | Max tokens in response (was `maxTokens`) |
| `temperature` | number | Sampling temperature (0-2) |
| `topP` | number | Nucleus sampling |
| `stopWhen` | `StepResult` | Stop condition (was `maxSteps`) |

## Reference

- Full API: `node_modules/ai/docs/07-reference/01-ai-sdk-core/01-generate-text.mdx`
- Related: [concepts/ai-sdk-basics.md](../concepts/ai-sdk-basics.md), [guides/building-agents.md](building-agents.md)