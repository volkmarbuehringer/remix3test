---
title: AI SDK Basics
description: Core concepts for working with Vercel AI SDK.
---

# Concept: AI SDK Basics

**Core Idea**: Vercel AI SDK is a framework for building AI-powered features with support for multiple providers (OpenAI, Anthropic, Google), streaming, tool calling, and structured output.

## Key Points

- **Core functions**: `generateText` (single response), `streamText` (streaming), `streamUI` (React streaming)
- **Provider pattern**: Use AI Gateway as default provider for unified access
- **Model selection**: Always fetch current model IDs from `ai-gateway.vercel.sh/v1/models`
- **Tool calling**: Define tools with `inputSchema` (not `parameters`)
- **Structured output**: Use `generateText` with `output` option, not deprecated `generateObject`

## Quick Example

```ts
import { generateText, tool } from 'ai';
import { gateway } from 'ai';

const weatherTool = tool({
  description: 'Get weather',
  inputSchema: z.object({ location: z.string() }),
  execute: async ({ location }) => ({ temp: 72 }),
});

const { text } = await generateText({
  model: gateway('anthropic/claude-sonnet-4.5'),
  prompt: 'What is the weather in NYC?',
  tools: { weather: weatherTool },
});
```

## Critical Rules

1. **Never trust internal knowledge** - always verify against docs/source
2. **Check `node_modules/ai/docs/`** before searching web
3. **Run typecheck** after any changes
4. **Be minimal** - only specify options that differ from defaults

## Reference

- Docs: `node_modules/ai/docs/`
- API: https://ai-sdk.dev