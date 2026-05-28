---
title: AI SDK DevTools Setup
description: Debug AI SDK calls by inspecting captured runs and steps.
---

# Example: DevTools

**Core Idea**: AI SDK DevTools captures all `generateText`, `streamText`, `ToolLoopAgent` calls to a local JSON file for debugging without manual logging.

## Key Points

- Requires AI SDK 6+ and `@ai-sdk/devtools` package
- Wrap model with `devToolsMiddleware()`
- Captures: requests, responses, tool calls, token usage
- Data saved to `.devtools/generations.json`

## Bookstore Setup: Shared Provider Utility

The bookstore uses a shared provider utility at `bookstore/app/utils/ai-provider.ts`:

```typescript
import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import { wrapLanguageModel } from 'ai'
import { devToolsMiddleware } from '@ai-sdk/devtools'

let _provider: ReturnType<typeof createOpenAICompatible> | undefined
let _model: ReturnType<typeof wrapLanguageModel> | undefined

export function getProvider() {
  if (!_provider) {
    let apiKey = process.env.OPENCODE_API_KEY
    if (!apiKey) {
      throw new Error('OPENCODE_API_KEY environment variable is not set')
    }
    _provider = createOpenAICompatible({
      baseURL: 'https://opencode.ai/zen/go/v1',
      name: 'opencode',
      apiKey,
    })
  }
  return _provider
}

export function getModel() {
  if (!_model) {
    let provider = getProvider()
    _model = wrapLanguageModel({
      model: provider.chatModel('minimax-m2.7'),
      middleware: devToolsMiddleware(),
    })
  }
  return _model
}
```

**Usage in controllers**:
- `bookstore/app/utils/ai-book-search.ts` — `generateText`
- `bookstore/app/controllers/assistant/controller.tsx` — `streamText`
- `bookstore/app/controllers/agent/controller.tsx` — `ToolLoopAgent`, `generateText`
- `bookstore/app/controllers/aisearch/controller.tsx` — `ToolLoopAgent`, `generateText`
- `bookstore/app/controllers/chat/controller.tsx` — `streamText`

## Manual Setup

```ts
import { wrapLanguageModel, gateway } from 'ai';
import { devToolsMiddleware } from '@ai-sdk/devtools';

const model = wrapLanguageModel({
  model: gateway('anthropic/claude-sonnet-4.5'),
  middleware: devToolsMiddleware(),
});
```

## Viewing Captured Data

```bash
# CLI - opens web UI at http://localhost:4983
npx @ai-sdk/devtools

# Manual - read JSON directly
cat .devtools/generations.json | jq
jq '.runs' .devtools/generations.json  # view runs only
```

## Data Structure

- **Run**: Complete multi-step interaction grouped by initial prompt
- **Step**: Single LLM call within a run (input, output, tool calls, tokens)

## Reference

- Package: `@ai-sdk/devtools@0.0.15`
- Docs: `node_modules/@ai-sdk/devtools/docs/`
- Location: `.devtools/generations.json`