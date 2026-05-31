<!-- Context: development/ai/lookup/ai-docs-reference | Priority: critical | Version: 1.0 | Updated: 2026-04-19 -->

# AI SDK Docs Reference

**Core Idea**: Bundled API documentation in `checker/node_modules/ai/docs/`. Most accurate source - always check here first.

## Doc Structure

```
checker/node_modules/ai/docs/
├── 07-reference/01-ai-sdk-core/    # Core APIs
├── 07-reference/02-ai-sdk-ui/      # UI hooks
├── 07-reference/03-ai-sdk-rsc/    # RSC APIs
└── 04-ai-sdk-ui/                  # Guides
```

## Quick Reference

| API | Location |
|-----|----------|
| `generateText` | `07-reference/01-ai-sdk-core/01-generate-text.mdx` |
| `streamText` | `07-reference/01-ai-sdk-core/02-stream-text.mdx` |
| `embed` | `07-reference/01-ai-sdk-core/05-embed.mdx` |
| `useChat` | `07-reference/02-ai-sdk-ui/01-use-chat.mdx` |
| `useCompletion` | `07-reference/02-ai-sdk-ui/02-use-completion.mdx` |
| `ToolLoopAgent` | `07-reference/01-ai-sdk-core/16-tool-loop-agent.mdx` |
| `tool()` | `07-reference/01-ai-sdk-core/20-tool.mdx` |
| Output APIs | `07-reference/01-ai-sdk-core/28-output.mdx` |

## Tools Pattern

```typescript
import { tool } from 'ai'
import { z } from 'zod'

const myTool = tool({
  description: 'Get weather for a location',
  inputSchema: z.object({ location: z.string() }),
  execute: async ({ location }) => ({ temp: 72 }),
})
```

## Output Options

```typescript
import { generateText, Output } from 'ai'

// Structured object
Output.object({ schema: z.object({ name: z.string() }) })

// Array of items
Output.array({ element: z.object({ ... }) })

// Choice from options
Output.choice({ options: ['a', 'b'] as const })

// Untyped JSON
Output.json()
```

## Key Parameters

| Parameter | Description |
|-----------|-------------|
| `model` | Language model instance |
| `system` | System prompt |
| `prompt` | User prompt (string or messages) |
| `tools` | Tool definitions |
| `output` | Structured output spec |
| `maxOutputTokens` | Max tokens (NOT `maxTokens`) |
| `stopWhen` | Stop condition (NOT `maxSteps`) |

## Searching Docs

```bash
grep -r "generateText" checker/node_modules/ai/docs/
grep -r "inputSchema" checker/node_modules/ai/docs/
```

## Additional Resources

- Examples: `checker/node_modules/ai/docs/04-ai-sdk-ui/` guides
- Changelog: `checker/node_modules/ai/CHANGELOG.md`

## Related

- `../concepts/ai-sdk-overview.md` - Overview
- `../errors/ai-sdk-common-errors.md` - Common errors
- `../guides/ai-sdk-type-safe.md` - Type safety