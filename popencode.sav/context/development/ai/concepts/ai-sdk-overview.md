<!-- Context: development/ai/concepts/ai-sdk-overview | Priority: critical | Version: 1.0 | Updated: 2026-04-19 -->

# AI SDK Overview

**Core Idea**: Vercel AI SDK for building AI-powered features with streaming, tools, and agents. Use ToolLoopAgent for agent patterns, always verify against current docs.

## Key Points

- **Core functions**: `generateText`, `streamText`, `ToolLoopAgent`, `embed`
- **Providers**: OpenAI, Anthropic, Google via AI Gateway (default)
- **React hooks**: `useChat`, `useCompletion` (see known changes)
- **Always verify**: Docs change frequently - check `node_modules/ai/docs/` first

## Critical Rules

1. **Install first**: `pnpm add ai` before searching docs
2. **Never trust memory**: Training data is outdated
3. **Check node_modules**: Search `node_modules/ai/docs/` and `src/`
4. **useChat has changed**: See `errors/ai-sdk-errors.md` for breaking changes
5. **Use AI Gateway**: Default provider unless specified
6. **Fetch model IDs**: Run `curl` to get current list, use highest version number

## Quick Example

```typescript
import { generateText } from 'ai'
import { createOpenAICompatible } from '@ai-sdk/openai-compatible'

const provider = createOpenAICompatible({
  baseURL: 'https://ai-gateway.vercel.sh/v1',
  apiKey: process.env.ANTHROPIC_API_KEY,
})

const result = await generateText({
  model: provider.chatModel('claude-sonnet-4-5'),
  prompt: 'Hello',
})
```

## Prerequisites

```bash
pnpm add ai
```

Provider packages installed later as needed.

## Resources

- Docs: `node_modules/ai/docs/` (preferred)
- Online: https://ai-sdk.dev

## Related

- `../guides/vercel-ai-sdk-agent.md` - Agent pattern
- `../errors/ai-sdk-common-errors.md` - Breaking changes
- `../guides/ai-sdk-type-safe.md` - Type safety