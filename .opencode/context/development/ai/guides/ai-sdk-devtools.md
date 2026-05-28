<!-- Context: development/ai/guides/ai-sdk-devtools | Priority: medium | Version: 1.0 | Updated: 2026-04-19 -->

# AI SDK DevTools

**Purpose**: Debug AI SDK calls by inspecting captured runs and steps locally.

## Setup

Requires AI SDK 6+. Install and wrap model:

```typescript
import { wrapLanguageModel, gateway } from 'ai'
import { devToolsMiddleware } from '@ai-sdk/devtools'

const model = wrapLanguageModel({
  model: gateway('anthropic/claude-sonnet-4.5'),
  middleware: devToolsMiddleware(),
})
```

## Viewing Captured Data

**File**: `.devtools/generations.json`

```bash
cat .devtools/generations.json | jq
```

**Web UI**:

```bash
npx @ai-sdk/devtools
# Opens http://localhost:4983
```

## Data Structure

| Level | Contains |
|-------|----------|
| Run | Complete multi-step interaction |
| Step | Single LLM call (input, output, tool calls, tokens) |

## Resources

- Package: `@ai-sdk/devtools`
- Docs: https://ai-sdk.dev

## Related

- `../concepts/ai-sdk-overview.md` - SDK overview
- `../errors/ai-sdk-common-errors.md` - Error fixes