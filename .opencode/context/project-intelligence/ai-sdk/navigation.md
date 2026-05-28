---
title: AI SDK
description: Context for building AI-powered features with Vercel AI SDK.
priority: high
---

# AI SDK Context

Reference for building AI-powered features using the Vercel AI SDK.

## Quick Links

| Category | File |
|----------|------|
| Core | [concepts/ai-sdk-basics.md](concepts/ai-sdk-basics.md) |
| Examples | [examples/gateway-usage.md](examples/gateway-usage.md), [examples/devtools-setup.md](examples/devtools-setup.md) |
| Guides | [guides/generate-text.md](guides/generate-text.md), [guides/stream-text.md](guides/stream-text.md), [guides/tool-loop-agent.md](guides/tool-loop-agent.md), [guides/tool-loop-agent-callbacks.md](guides/tool-loop-agent-callbacks.md), [guides/building-agents.md](guides/building-agents.md), [guides/type-safe-agents.md](guides/type-safe-agents.md) |
| Lookup | [lookup/navigation.md](lookup/navigation.md) | Quick reference tables (model IDs, params, types) |
| Errors | [errors/useChat-changes.md](errors/useChat-changes.md), [errors/api-renames.md](errors/api-renames.md) |

## Key Points

- Always fetch current model IDs via AI Gateway API
- Use `generateText` with `output` instead of deprecated `generateObject`
- `useChat` no longer manages input state - use manual `useState`
- Type-safe agents use `InferAgentUIMessage<typeof agent>`

## Related

- Context7: `context7` skill for current docs
- DevTools: `.devtools/generations.json` for debugging