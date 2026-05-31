<!-- Context: development/ai/guides/vercel-ai-sdk-agent | Priority: critical | Version: 1.2 | Updated: 2026-04-11 -->

# AI Agent with Vercel AI SDK

Implements AI agents with tool-calling using Vercel AI SDK.

## Overview

1. Install `@ai-sdk/openai-compatible` + `ai`
2. Define tools with `tool()` + Zod
3. Create `ToolLoopAgent` with provider + tools
4. Call `agent.generate()` for tool execution

## Dependencies

```bash
pnpm add ai @ai-sdk/openai-compatible zod
```

## Tool Definition

```typescript
import { tool } from 'ai'
import { z } from 'zod'

const tools = {
  get_weather: tool({
    description: 'Get weather. Input: {"location": "Berlin"}',
    inputSchema: z.object({ location: z.string().describe('City name') }),
    execute: async ({ location }) => await fetchWeather(location),
  }),
}
```

## Create Agent

```typescript
import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import { ToolLoopAgent } from 'ai'

const provider = createOpenAICompatible({
  baseURL: 'https://opencode.ai/zen/go/v1',
  name: 'opencode',
  apiKey: process.env.OPENCODE_API_KEY,
})

const agent = new ToolLoopAgent({
  model: provider.chatModel('minimax-m2.7'),
  tools,
  instructions: `Use get_weather with JSON like {"location": "Berlin"}`,
})
```

## Use in Controller

```typescript
let result = await agent.generate({ prompt: message })
let response = result.steps?.map((s) => s.text).join('') ?? result.text
```

## API Reference

| Property | Value |
|----------|-------|
| Package | `ai` |
| Agent | `ToolLoopAgent` |
| Provider | `@ai-sdk/openai-compatible` |
| Base URL | `https://opencode.ai/zen/go/v1` |
| Model | `minimax-m2.7` |

## Resources

- [Vercel AI SDK](https://sdk.vercel.ai/docs/ai-sdk-core)
- [ToolLoopAgent](https://sdk.vercel.ai/docs/ai-sdk-core/tool-tool)
