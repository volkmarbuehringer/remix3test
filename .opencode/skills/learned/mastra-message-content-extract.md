---
name: mastra-message-content-extract
description: "Extract readable text from MastraDBMessage content with MastraMessageContentV2 format"
origin: auto-extracted
---

# Mastra Message Content Extraction

**Extracted:** 2026-07-06
**Context:** Reading assistant/user messages from Mastra Memory via `memory.recall()` for display in a UI or admin chat log viewer

## Problem

Mastra memory stores messages using `MastraMessageContentV2` format internally — an object shape like `{ format: 2, parts: [{ type: 'text', text: 'Hello' }, ...] }` — rather than a plain string. When you read messages via `memory.recall({ threadId })` and try to display `message.content` directly, you get `[object Object]` because `String(content)` serializes the nested object without extracting the actual text parts.

This happens silently: the app doesn't crash, the response just renders as `[object Object]`.

## Solution

Use a recursive extraction function that handles Mastra's V2 content format:

```typescript
function extractTextContent(content: unknown): string {
  // Plain string — return as-is (legacy/other formats)
  if (typeof content === 'string') return content

  // MastraMessageContentV2: { format: 2, parts: [...] }
  if (content && typeof content === 'object') {
    let obj = content as Record<string, unknown>
    if (obj.format === 2 && Array.isArray(obj.parts)) {
      let texts: string[] = []
      for (let part of obj.parts) {
        let p = part as Record<string, unknown>
        // Text parts have type: 'text' and a text field
        if (p.type === 'text' && typeof p.text === 'string') {
          texts.push(p.text)
        }
        // Tool-call parts, reasoning parts etc. can be ignored
        // for plain text display
      }
      if (texts.length > 0) return texts.join('\n')
    }
    // Fallback: object with a .text property
    if (typeof obj.text === 'string') return obj.text
  }

  // Array of parts (older format)
  if (Array.isArray(content)) {
    return content.map(c => extractTextContent(c)).filter(Boolean).join('\n')
  }

  // Last resort — JSON stringify for debugging
  return JSON.stringify(content)
}
```

### Usage with Mastra Memory:

```typescript
let agent = mastra.getAgent('supportAgent')
let memory = await agent.getMemory()
if (!memory) throw new Error('Memory not available')

let { messages } = await memory.recall({
  threadId: 'some-thread-id',
  perPage: false,
})

for (let msg of messages) {
  let text = extractTextContent(msg.content)
  console.log(`${msg.role}: ${text}`)
}
```

### What's happening inside Mastra:

The `MastraDBMessage.content` field has type `MastraMessageContentV2`:

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

The function above extracts only `type: 'text'` parts — tool calls, reasoning blocks, and metadata are stripped, giving you clean conversation text.

## When to Use

- Reading conversation history from Mastra memory for display in a UI
- Building an admin chat log viewer that reads from Mastra threads/messages
- Processing message content from `memory.recall()` output
- Migrating away from a custom chatlog store to Mastra memory and needing to render old messages
