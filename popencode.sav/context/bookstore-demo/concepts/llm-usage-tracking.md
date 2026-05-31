<!-- Context: bookstore-demo/concepts | Priority: high | Version: 1.0 | Updated: 2026-04-12 -->

# LLM Usage Tracking

**Core Idea**: Track LLM call timing and token usage by capturing start/end timestamps and using streamText callbacks. Store elapsed time with each chat message for analytics.

---

## Key Points

- **Timing**: Capture `Date.now()` before and after streamText call
- **Usage**: Use `onFinish` callback to capture token usage
- **Storage**: Store elapsed time in message JSON alongside user/assistant content
- **Display**: Show elapsed time in admin chatlog UI

---

## Quick Example

### Controller Timing and Usage

```typescript
let llmStartTime = Date.now()
let usage: { inputTokens?: number; outputTokens?: number; totalTokens?: number } = {}

let result = streamText({
  model: provider.chatModel(modelId),
  maxOutputTokens: 1024,
  system: SYSTEM_PROMPT,
  messages,
  timeout: 20000,
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

### Storage with Elapsed Time

```typescript
// ChatLogRow interface with elapsed optional
interface ChatMessage {
  user: string
  assistant: string
  elapsed?: number  // Optional elapsed time in ms
}

// Save message with elapsed time
let updatedChatLog = await appendMessage(
  chatId,
  { user: message, assistant: responseText },
  llmElapsed
)

// appendMessage implementation
export async function appendMessage(
  id: string,
  message: ChatMessage,
  elapsed?: number
): Promise<ChatLogRow | null> {
  // Include elapsed time if provided
  let messageToSave = elapsed ? { ...message, elapsed } : message
  let messageJson = JSON.stringify(messageToSave)

  await db.exec(sql`
    UPDATE chatlog
    SET conversation = conversation || ${messageJson}::jsonb,
        updated_at = ${now}
    WHERE id = ${id}
  `)
}
```

---

## Response Data

Return elapsed time and usage to client:

```typescript
return Response.json({
  frameUrl,
  timestamp,
  conversationId: chatId,
  elapsed: llmElapsed,
  usage,
})
```

---

## Codebase References

- `bookstore/app/controllers/chat/controller.tsx` - Full timing implementation (lines 169-222)
- `bookstore/app/lib/chatlog.ts` - ChatMessage with elapsed (lines 6-10)
- `bookstore/app/controllers/admin/chatlog/page.tsx` - UI display

---

## Related

- [chat-conversation-tracking.md](chat-conversation-tracking.md) - Server-side tracking
- [streamtext-options.md](../lookup/streamtext-options.md) - Timeout and callbacks
- [admin-chatlog-routes.md](../guides/admin-chatlog-routes.md) - Admin viewing