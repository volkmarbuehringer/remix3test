<!-- Context: development/ai/concepts/agent-route | Priority: medium | Version: 1.0 | Updated: 2026-04-18 -->

# Concept: AI Agent Route Implementation

**Purpose**: Tool-calling AI agent with get_weather and search_wikipedia tools.

---

## Core Concept

The `/agent` route implements a tool-calling AI agent using Vercel AI SDK's `ToolLoopAgent`. Unlike chat, the agent autonomously calls tools to fulfill user requests. Conversations persist in `chatlog` table with tool call metadata.

---

## Key Files

| File | Purpose |
|------|---------|
| `checker/app/controllers/agent/controller.tsx` | Agent init, tools, action handler |
| `checker/app/controllers/agent/page.tsx` | UI with css() |
| `checker/app/lib/chatlog.ts` | Conversation storage |

---

## Available Tools

- **get_weather**: Fetches weather via Open-Meteo API, input: `{ location: string }`
- **search_wikipedia**: Searches Wikipedia, input: `{ query: string }`

---

## UI Patterns

### css() from remix/ui

```tsx
import { css } from 'remix/ui'

<div mix={css({ display: 'flex', gap: '1rem' })} />
```

### Flex Empty State

```tsx
<div mix={css({
  display: 'flex', flexDirection: 'column',
  alignItems: 'center', justifyContent: 'center',
  textAlign: 'center', flex: 1,
})} />
```

---

## Agent vs Chat Distinction

In `/admin/chatlog`, check for `toolCalls`:

```tsx
let hasToolCalls = conv.conversation.some(
  msg => msg.toolCalls?.length > 0
)
let link = hasToolCalls
  ? `/agent?agentId=${conv.id}`
  : `/chat?chatId=${conv.id}`
```

Badge: Agent (`#7c3aed` purple), Chat (`#22c55e` green)

---

## Key Pattern: decode() for HTML Entities

```tsx
function decode(text: string): string {
  let result = text
  // Round 1: &amp; prefixed
  result = result.replace(/&amp;#39;/g, '&#39;')
  result = result.replace(/&amp;#8217;/g, '&#8217;')
  // Round 2: numeric
  result = result.replace(/&#39;/g, "'")
  result = result.replace(/&#8217;/g, "'")
  // Round 3: named
  result = result.replace(/&lt;/g, '<')
  result = result.replace(/&gt;/g, '>')
  return result
}
```

---

**Reference**: `guides/agent-toolloop-pattern.md`, `concepts/ai-book-search.md`