---
title: ToolLoopAgent
description: Reusable AI agent with tool calling loop.
---

# Guide: ToolLoopAgent

**Core Idea**: `ToolLoopAgent` creates reusable agents that iteratively call tools, collect results, and reason until a stop condition is reached. Use for autonomous multi-step tasks.

## Key Points

- **vs `generateText`**: Agent manages loop, context, stopping; `generateText` is single-step
- **Constructor options**: `model`, `instructions`, `tools`, `stopWhen`, `toolChoice`, `output`
- **Methods**: `generate()` (blocking), `stream()` (streaming)
- **Stop conditions**: `stepCountIs(n)`, custom conditions
- **Callbacks**: `onStepFinish`, `onFinish`, `prepareStep`
- **Model**: Use string `"provider/model"` for AI Gateway, or `gateway("model")` for explicit

## Basic Example

```ts
import { ToolLoopAgent } from 'ai';

const agent = new ToolLoopAgent({
  model: "anthropic/claude-sonnet-4.5",
  instructions: 'You are a helpful assistant.',
});

const result = await agent.generate({
  prompt: 'What is the weather in NYC?',
});

console.log(result.text);
```

## With Tools

```ts
import { ToolLoopAgent, tool } from 'ai';
import { z } from 'zod';

const agent = new ToolLoopAgent({
  model: "anthropic/claude-sonnet-4.5",
  instructions: 'You are a helpful assistant.',
  tools: {
    weather: tool({
      inputSchema: z.object({ location: z.string() }),
      execute: async ({ location }) => ({ temp: 72 }),
    }),
  },
});

const { text } = await agent.generate({
  prompt: 'What is the weather in NYC?',
});
```

## With Structured Output

```ts
import { ToolLoopAgent, Output } from 'ai';
import { z } from 'zod';

const analysisAgent = new ToolLoopAgent({
  model: "anthropic/claude-sonnet-4.5",
  output: Output.object({
    schema: z.object({
      sentiment: z.enum(['positive', 'neutral', 'negative']),
      summary: z.string(),
      keyPoints: z.array(z.string()),
    }),
  }),
});

const { output } = await analysisAgent.generate({
  prompt: 'Analyze this feedback: Great product, loved it!',
});

console.log(output.sentiment); // "positive"
```

## Key Options

| Option | Type | Description |
|--------|------|-------------|
| `model` | string | Provider/model string (e.g., `"anthropic/claude-sonnet-4.5"`) |
| `instructions` | string | System prompt |
| `tools` | Record<string, Tool> | Available tools |
| `stopWhen` | StopCondition | When to stop (default: 20 steps) |
| `toolChoice` | string | 'auto' \| 'none' \| 'required' |
| `output` | Output | Structured output schema |
| `onStepFinish` | callback | Called after each step |
| `onFinish` | callback | Called when done |

## Streaming

```ts
const stream = agent.stream({
  prompt: 'What is the weather?',
});

for await (const chunk of stream.textStream) {
  process.stdout.write(chunk);
}
```

## Reference

- Full API: `node_modules/ai/docs/07-reference/01-ai-sdk-core/16-tool-loop-agent.mdx`
- Related: [guides/building-agents.md](building-agents.md), [guides/type-safe-agents.md](type-safe-agents.md)