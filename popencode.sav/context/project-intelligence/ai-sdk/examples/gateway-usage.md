---
title: AI Gateway Usage
description: Reference for using Vercel AI Gateway with the AI SDK.
---

# Example: AI Gateway

**Core Idea**: Vercel AI Gateway provides unified access to OpenAI, Anthropic, Google, and other providers through a single API with automatic model selection.

## Key Points

- Default global provider - use model string like `'anthropic/claude-sonnet-4.5'`
- Auth via `AI_GATEWAY_API_KEY` in `.env.local`
- Explicit import: `import { gateway } from 'ai'` or `'@ai-sdk/gateway'`
- **Always fetch current models** - never use cached model IDs

## Setup

```env
AI_GATEWAY_API_KEY=your_api_key_here
```

## Finding Available Models

```bash
# Anthropic (latest first)
curl -s https://ai-gateway.vercel.sh/v1/models | jq -r '[.data[] | select(.id | startswith("anthropic/")) | .id] | reverse | .[]'

# OpenAI
curl -s https://ai-gateway.vercel.sh/v1/models | jq -r '[.data[] | select(.id | startswith("openai/")) | .id] | reverse | .[]'

# Google
curl -s https://ai-gateway.vercel.sh/v1/models | jq -r '[.data[] | select(.id | startswith("google/")) | .id] | reverse | .[]'
```

Use highest version number (e.g., `claude-sonnet-4-5` over `claude-sonnet-4`).

## Basic Usage

```ts
import { generateText, gateway } from 'ai';

const { text } = await generateText({
  model: gateway('anthropic/claude-sonnet-4.5'),
  prompt: 'Hello',
});
```

## Reference

- Dashboard: https://vercel.com/dashboard/ai-gateway