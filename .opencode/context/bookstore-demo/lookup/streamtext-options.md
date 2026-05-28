<!-- Context: bookstore-demo/lookup | Priority: critical | Version: 1.0 | Updated: 2026-04-12 -->

# StreamText Options Reference

Quick reference for Vercel AI SDK streamText options including timeout, callbacks, and usage tracking.

---

## Key Options

| Option | Type | Description |
|--------|------|------------|
| `timeout` | `number` | Request timeout in milliseconds (default: none) |
| `onFinish` | `function` | Called when streaming completes with usage data |
| `onError` | `function` | Called when an error occurs during streaming |

---

## Quick Example

```typescript
let llmStartTime = Date.now()
let usage = {}

let result = streamText({
  model: provider.chatModel('minimax-m2.7'),
  maxOutputTokens: 1024,
  system: SYSTEM_PROMPT,
  messages,
  timeout: 20000,  // 20 second timeout
  onError({ error }) {
    console.error('[Chat] LLM error:', error)
  },
  onFinish({ usage: finishUsage }) {
    usage = {
      inputTokens: finishUsage.inputTokens,
      outputTokens: finishUsage.outputTokens,
      totalTokens: finishUsage.totalTokens,
    }
    console.log('[Chat] LLM usage:', usage)
  },
})

// Collect streaming response
let responseText = ''
for await (let chunk of result.textStream) {
  responseText += chunk
}

let llmElapsed = Date.now() - llmStartTime
console.log('[Chat] LLM elapsed:', llmElapsed, 'ms')
```

---

## Options Detail

### timeout

**Purpose**: Built-in timeout to prevent streaming from hanging indefinitely.

- **Default**: None (no timeout)
- **Recommended**: 20000ms (20 seconds) for chat responses

```typescript
timeout: 20000  // 20 second timeout
```

When timeout triggers, the stream throws an `AbortError` that can be caught and handled gracefully.

### onError

**Purpose**: Handle errors during streaming without losing the entire request.

```typescript
onError({ error }) {
  console.error('[Chat] LLM error:', error)
  // Log error for debugging, but don't expose to client
}
```

The callback receives an `{ error }` object with the error details.

### onFinish

**Purpose**: Capture usage statistics after streaming completes successfully.

```typescript
onFinish({ usage: finishUsage }) {
  console.log('Input tokens:', finishUsage.inputTokens)
  console.log('Output tokens:', finishUsage.outputTokens)
  console.log('Total tokens:', finishUsage.totalTokens)
}
```

**Usage object properties**:
- `inputTokens`: Tokens in the prompt
- `outputTokens`: Tokens generated
- `totalTokens`: input + output

---

## Response Data

After streaming, the response includes:

```typescript
return Response.json({
  frameUrl,
  timestamp,
  conversationId: chatId,
  elapsed: llmElapsed,       // Time in milliseconds
  usage,                  // { inputTokens, outputTokens, totalTokens }
})
```

---

## Codebase References

- `bookstore/app/controllers/chat/controller.tsx` - Full implementation (lines 169-222)
- `bookstore/app/lib/chatlog.ts` - Stores elapsed time with messages

---

## Related

- [chat-conversation-tracking.md](../concepts/chat-conversation-tracking.md) - Server-side conversation tracking
- [ai-implementation-patterns.md](ai-implementation-patterns.md) - Basic streamText pattern
- [admin-chatlog-routes.md](../guides/admin-chatlog-routes.md) - Admin filtering