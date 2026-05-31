---
title: API Renames
description: Deprecated API names and their replacements.
---

# Error: API Renames

**Core Idea**: Multiple AI SDK APIs have been renamed. Use the new names to avoid deprecation warnings and type errors.

## Key Points

- `parameters` → `inputSchema` in tool definitions
- `maxTokens` → `maxOutputTokens` 
- `maxSteps` → `stopWhen: isStepCount(n)`
- `generateObject` → `generateText` with `output`
- `addToolResult` → `addToolOutput`
- `messages` → `uiMessages` in `createAgentUIStreamResponse`

## Tool Definition

```ts
// ❌ Deprecated
const weatherTool = tool({
  parameters: z.object({ location: z.string() }),  // use inputSchema
});

// ✅ Correct
const weatherTool = tool({
  inputSchema: z.object({ location: z.string() }),
});
```

## Generate Options

```ts
// ❌ Deprecated
const result = await generateText({
  maxTokens: 512,
  tools: { weather },
  prompt: '...',
});

// ✅ Correct
const result = await generateText({
  maxOutputTokens: 512,
  tools: { weather },
  prompt: '...',
});
```

## Step Limits

```ts
// ❌ Deprecated
const result = await generateText({
  maxSteps: 5,
  tools: { weather },
  prompt: '...',
});

// ✅ Correct
import { isStepCount } from 'ai';

const result = await generateText({
  stopWhen: isStepCount(5),
  tools: { weather },
  prompt: '...',
});
```

## Structured Output

```ts
// ❌ Deprecated
import { generateObject } from 'ai';

const result = await generateObject({
  model: 'anthropic/claude-sonnet-4.5',
  schema: z.object({ name: z.string() }),
  prompt: '...',
});

// ✅ Correct
import { generateText, Output } from 'ai';

const result = await generateText({
  model: 'anthropic/claude-sonnet-4.5',
  output: Output.object({
    schema: z.object({ name: z.string() }),
  }),
  prompt: '...',
});

console.log(result.output); // typed object
```

## Other Output Options

```ts
// Array of items
Output.array({ element: z.object({ ... }) })

// Choice from options
Output.choice({ options: ['a', 'b', 'c'] as const })

// Untyped JSON
Output.json()
```

## Tool Output

```ts
// ❌ Deprecated
addToolResult({
  toolCallId: part.toolCallId,
  result: 'Yes',
});

// ✅ Correct
addToolOutput({
  tool: 'askForConfirmation',
  toolCallId: part.toolCallId,
  output: 'Yes',
});
```

## Stream Response

```ts
// ❌ Deprecated
return createAgentUIStreamResponse({
  agent: myAgent,
  messages,
});

// ✅ Correct
return createAgentUIStreamResponse({
  agent: myAgent,
  uiMessages: messages,
});
```

## Reference

- Full list: See navigation.md for overview
- See also: [concepts/ai-sdk-basics.md](../concepts/ai-sdk-basics.md)