# Inline Model Config (Defer Model Resolution)

## What This Covers

Constructing a Mastra `Agent` without eager model resolution. Read this when embedding Mastra in a non-Mastra framework (Remix, Next.js, Express, Fastify), when some routes don't use AI, when tests import the module without credentials, or when wrapping an agent with `createDurableAgent()` (the durable wrapper resolves the model at construction, even with an inline model config).

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
    modelId: 'deepseek-v4.1-flash',
    url: 'https://opencode.ai/zen/go/v1',
    apiKey: process.env.OPENCODE_API_KEY, // undefined is fine at import time
  },
  tools: { ... },
})
```

The inline config works with any OpenAI-compatible provider. Supported fields:

- `providerId` — Provider identifier (matches the `name` in `createOpenAICompatible`)
- `modelId` — Model name (e.g. `deepseek-v4.1-flash`, `gpt-4o`). OpenCode Go publishes several DeepSeek ids (`deepseek-v4.1-flash`, `deepseek-v4-flash`, `deepseek-v4-pro`) as *separate* models with separate monthly usage limits — changing the id here also means changing the `provider.opencode-go.models` key in `opencode.json`.
- `url` — Base URL for the API endpoint
- `apiKey` — API key (can be `undefined`; only fails when the agent is actually used)
- `headers` — Additional HTTP headers merged into every outbound request (e.g. `{ 'X-Opencode-Session': '<stable-id>' }`, canonical PascalCase per the `remix-headers` lint rule; HTTP header names are case-insensitive on the wire); Mastra merges them with its own `User-Agent: mastra/<version>` and per-run memory headers (`x-thread-id`, `x-resource-id`)

### Benefits

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

## Durable Wrappers Re-Introduce Eager Resolution

`createDurableAgent({ agent })` (`@mastra/core/agent/durable`, 1.45.0+) resolves
the model **at construction even when the wrapped agent uses the inline config**.
`DurableAgent`'s constructor builds itself with
`model: agent.__model ?? agent.getModel()`, so `agent.getModel()` runs eagerly and
throws `AGENT_GET_MODEL_MISSING_MODEL_INSTANCE` when the key is unset. Wrapping at
module load therefore re-breaks the lazy startup you just fixed — and it surfaces
as the whole `remix test` worker dying at import, not as a failing assertion.

```ts
// BAD: crashes at module load if the key is unset, despite the agent's inline config
const durableCustomerAgent = createDurableAgent({ agent: customerAgent })
export const mastra = new Mastra({ agents: { customerAgent, durableCustomerAgent } })
```

Create and register the wrapper lazily on first use, with a distinct id so the
durable workflow's `getAgentById(agentId)` rebuild resolves the wrapper, not the
raw agent registered alongside it:

```ts
import type { Agent } from '@mastra/core/agent'
import { createDurableAgent } from '@mastra/core/agent/durable'

let durableCustomerAgent: Agent | undefined

export function getDurableCustomerAgent(): Agent {
  if (!durableCustomerAgent) {
    durableCustomerAgent = createDurableAgent({
      agent: customerAgent as unknown as Agent, // widen the id literal
      id: 'customer-agent-durable',
    }) as unknown as Agent
    mastra.addAgent(durableCustomerAgent, 'durableCustomerAgent')
  }
  return durableCustomerAgent
}
```

The `as unknown as Agent` casts only widen `Agent<'customer-agent', …>` to
`Agent<string, …>` so the `id` override type-checks; the runtime object is the
real `DurableAgent`.

## When to Use

- Embedding Mastra agents inside a non-Mastra framework (Remix, Next.js, Express, Fastify)
- Multiple routes where some use AI and others don't — you don't want every route to fail when the API key is missing
- Setting up a Mastra dev server (`mastra dev`) alongside an existing app — the CLI entry point can re-export the same agent config
- Tests that need to import the module without triggering model initialization
- Wrapping an agent with `createDurableAgent()` — the wrapper resolves the model at construction, so it belongs behind the same lazy getter as the agent
