---
title: Building Agents
description: Creating AI agents with ToolLoopAgent pattern.
---

# Guide: Building Agents

**Core Idea**: Use `ToolLoopAgent` pattern for creating AI agents that can use tools in a loop. Always verify current APIs in `node_modules/ai/docs/`.

## Key Points

- Use `ToolLoopAgent` for agent creation (not legacy patterns)
- Check `node_modules/ai/docs/` for current API
- File structure: `lib/agents/` for agents, `lib/tools/` for tools
- Consume with `useChat` + `InferAgentUIMessage` for type safety

## Agent Pattern

```ts
import { ToolLoopAgent } from 'ai';
import { weatherTool } from '../tools/weather-tool';

export const myAgent = new ToolLoopAgent({
  model: 'anthropic/claude-sonnet-4',
  instructions: 'You are a helpful assistant.',
  tools: {
    weather: weatherTool,
  },
});
```

## Framework-Specific Consumption

Before implementing:

1. Check `package.json` to detect framework
2. Search docs for framework quickstart
3. Follow framework patterns for streaming, API routes, client integration

## Type Safety

See [guides/type-safe-agents.md](type-safe-agents.md) for end-to-end type safety with `InferAgentUIMessage`.

## Reference

- Agent docs: `node_modules/ai/docs/`