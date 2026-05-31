---
title: streamText
description: Core API for streaming text generation.
---

# Guide: streamText

**Core Idea**: `streamText` streams text in real-time for interactive applications like chatbots. Returns async iterables for text, deltas, tool calls, and UI messages.

## Key Points

- **Returns**: `{ textStream, text, toolCalls, finishReason, usage, ... }`
- **Use for**: Chatbots, real-time UIs, streaming responses
- **Response methods**: `toTextStreamResponse()`, `toDataStreamResponse()`, `toUIMessageStreamResponse()`
- **Tool streaming**: `toolCallStream` for incremental tool input collection
- **Works with**: `useChat`, `useCompletion`, custom transports

## Quick Example

```ts
import { streamText } from 'ai';
import { gateway } from 'ai';

const result = streamText({
  model: gateway('anthropic/claude-sonnet-4.5'),
  prompt: 'Count from 1 to 5',
});

for await (const chunk of result.textStream) {
  process.stdout.write(chunk);
}
```

## HTTP Streaming

```ts
// app/api/chat/route.ts
import { streamText } from 'ai';
import { gateway } from 'ai';

export async function POST(req: Request) {
  const result = streamText({
    model: gateway('anthropic/claude-sonnet-4.5'),
    messages: await req.json(),
  });

  return result.toUIMessageStreamResponse();
}
```

## With Tools

```ts
const result = streamText({
  model: gateway('anthropic/claude-sonnet-4.5'),
  prompt: 'Get weather for New York',
  tools: {
    weather: tool({
      inputSchema: z.object({ location: z.string() }),
      execute: async ({ location }) => ({ temp: 72 }),
    }),
  },
});

// Stream text chunks
for await (const chunk of result.textStream) {
  // process chunk
}

// Get tool calls after completion
const { toolCalls } = await result;
```

## Response Methods

| Method | Use Case |
|--------|----------|
| `toUIMessageStreamResponse()` | `useChat` / React streaming |
| `toDataStreamResponse()` | Custom clients |
| `toTextStreamResponse()` | Simple text streaming |

## Reference

- Full API: `node_modules/ai/docs/07-reference/01-ai-sdk-core/02-stream-text.mdx`
- Related: [guides/generate-text.md](generate-text.md), [examples/gateway-usage.md](../examples/gateway-usage.md)