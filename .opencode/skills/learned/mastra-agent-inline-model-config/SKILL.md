---
name: mastra-agent-inline-model-config
description: "Use inline model config objects to defer model resolution and avoid module-load crashes when embedding Mastra"
origin: auto-extracted
---

# Mastra Agent Inline Model Config

**Extracted:** 2026-07-06
**Context:** Embedding Mastra agents inside non-Mastra frameworks (Remix, Next.js, Express) where the LLM API key may not be available at startup

## Problem

When constructing a Mastra `Agent` at module level, `model: getModel()` evaluates eagerly at import time. If the API key is missing or the provider isn't configured, the **entire app** crashes on startup — not just the AI route.

```ts
// BAD: throws at module load if OPENCODE_API_KEY is unset
export const agent = new Agent({
  model: getModel(), // <-- eagerly called at import time
  tools: { ... },
})
```

This is especially problematic when Mastra is embedded inside a larger app (Remix, Next.js) where other routes don't depend on the LLM.

## Solution

Use Mastra's inline model config object instead of a model instance. Mastra resolves it lazily at runtime when `agent.generate()` is first called.

```ts
// GOOD: stored as plain object, resolved lazily by Mastra
export const agent = new Agent({
  model: {
    providerId: 'opencode-go',
    modelId: 'deepseek-v4-flash',
    url: 'https://opencode.ai/zen/go/v1',
    apiKey: process.env.OPENCODE_API_KEY, // undefined is fine at import time
  },
  tools: { ... },
})
```

The inline config works with any OpenAI-compatible provider. The supported fields are:

- `providerId` — Provider identifier (matches the `name` in `createOpenAICompatible`)
- `modelId` — Model name (e.g. `deepseek-v4-flash`, `gpt-4o`)
- `url` — Base URL for the API endpoint
- `apiKey` — API key (can be `undefined`; only fails when the agent is actually used)

## Benefits

1. **No module-load crash** — missing API key only breaks the specific AI route, not the whole app
2. **Compatible with Mastra Studio** — agents can be registered in the `Mastra()` constructor via `agents: { agent }` without eager model evaluation
3. **Simpler test setup** — tests that don't exercise the agent won't crash on missing credentials
4. **Works with lazy getters** — combine with a lazy singleton pattern for deferred construction

## Combined with Lazy Registration

For maximum resilience, combine with a lazy getter and `mastra.addAgent()`:

```ts
let _agent: Agent | null = null

export function getSupportAgent(): Agent {
  if (!_agent) {
    _agent = new Agent({
      model: { providerId: '...', modelId: '...', url: '...', apiKey: process.env.API_KEY },
      tools: { ... },
    })
    mastra.addAgent(_agent) // register so Mastra Studio can see it
  }
  return _agent
}
```

## When to Use

- Embedding Mastra agents inside a non-Mastra framework (Remix, Next.js, Express, Fastify)
- Multiple routes where some use AI and others don't — you don't want every route to fail when the API key is missing
- Setting up a Mastra dev server (`mastra dev`) alongside an existing app — the CLI entry point can re-export the same agent config
- Tests that need to import the module without triggering model initialization

## See Also

- The demo project at `~/mastra-agent-course/` for a standalone Mastra setup using inline model configs
- Mastra docs on `@mastra/core/agent` for the Agent constructor API
