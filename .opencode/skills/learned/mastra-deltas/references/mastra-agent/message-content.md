# Message Content Normalization

## What This Covers

Normalizing Mastra message `content` to plain text. Read this when building a chat UI, admin log viewer, or export tool, or when a controller has duplicated content-extraction logic.

## Problem

Mastra message `content` can be:

- **Plain string:** `"Hello world"`
- **Structured format v2:** `{ format: 2, parts: [{ type: 'text', text: 'Hello' }] }`
- **Object with `.text`:** `{ text: "Hello" }`
- **Array of mixed formats:** `["Hello", { text: "world" }]`

This happens silently when rendered directly: `String(content)` produces `[object Object]` instead of the actual text.

Without normalization, every consumer (chat UI, admin log viewer, audit export) must duplicate the extraction logic — and miss edge cases.

## Solution

Extract a shared `messageContentToText()` utility and apply it at the memory boundary so all consumers receive clean `content: string`.

**The utility** (`app/utils/message-content.ts`):

```ts
export function messageContentToText(content: unknown): string {
  if (typeof content === 'string') return content
  if (content && typeof content === 'object') {
    let obj = content as Record<string, unknown>
    if (obj.format === 2 && Array.isArray(obj.parts)) {
      return obj.parts
        .filter((p) => (p as Record<string, unknown>).type === 'text')
        .map((p) => (p as Record<string, unknown>).text as string)
        .join('\n')
    }
    if (typeof obj.text === 'string') return obj.text
  }
  if (Array.isArray(content)) {
    return content
      .map((c) => messageContentToText(c))
      .filter(Boolean)
      .join('\n')
  }
  return String(content ?? '')
}
```

**At the memory boundary** (e.g., `recall` wrapper):

```ts
let { messages } = await memory.recall({ threadId, perPage: false })
let chatMessages = (messages ?? [])
  .filter((m) => m.role === 'user' || m.role === 'assistant')
  .map((m) => ({
    role: m.role as 'user' | 'assistant',
    content: messageContentToText(m.content),
    timestamp:
      typeof m.createdAt === 'string' ? new Date(m.createdAt).getTime() : Number(m.createdAt),
  }))
```

## What's happening inside Mastra

Mastra's internal `MastraDBMessage.content` uses the `MastraMessageContentV2` type:

```typescript
type MastraMessageContentV2 = {
  format: 2
  parts: Array<{
    type: 'text' | 'tool-call' | 'reasoning' | ...
    text?: string        // only on text parts
    args?: unknown       // on tool-call parts
    ...
  }>
  toolInvocations?: ...
  reasoning?: ...
}
```

The utility above extracts only `type: 'text'` parts — tool calls, reasoning blocks, and metadata are stripped, giving you clean conversation text.

## When to Use

- Any consumer of Mastra `memory.recall()` or `agent.generate()` output
- When building a chat UI, admin log viewer, or export tool that shows message content
- When the controller has duplicated content-extraction logic
