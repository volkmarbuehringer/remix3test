<!-- Context: project-intelligence/my_app/lookup | Priority: medium | Version: 1.0 | Updated: 2026-05-02 -->

# Lookup: Chat Pattern Reference

## Route Table

| Route | Method | File | Type |
|-------|--------|------|------|
| `chat` | GET+POST | `app/actions/chat/controller.tsx` | Directory (multi-action) |

## Key Files

| File | Purpose |
|------|---------|
| `app/actions/chat/controller.tsx` | GET/POST handlers, rate limiting, LLM orchestration |
| `app/actions/chat/page.tsx` | ChatPage: messages display, error banner, form |
| `app/lib/chatlog.ts` | DB layer: CRUD, optimistic concurrency, in-memory return |

## Quick Patterns

### Rate Limiting

```typescript
let lastChatTime = 0
const RATE_LIMIT_MS = 2000

function action() {
  let now = Date.now()
  if (now - lastChatTime < RATE_LIMIT_MS) {
    return Response.json({ error: 'Please wait' }, { status: 429 })
  }
  lastChatTime = now
}
```

Module-level guard. Resets on server restart. No external dependency.

### Optimistic Concurrency (appendMessage)

```typescript
let result = await db.exec(sql`
  UPDATE chatlog
  SET conversation = ${JSON.stringify(updated)}::jsonb, updated_at = ${now}
  WHERE id = ${id}
  AND jsonb_array_length(conversation) = ${existing.conversation.length}
`)
if (result.affectedRows === 0) {
  // Concurrent modification — re-fetch latest state
  return getConversation(id)
}
// In-memory result (no re-fetch)
return { id, conversation: updated, created_at, updated_at: now }
```

### Error Banner

```typescript
// Controller: on LLM failure, redirect with error param
redirectUrl.searchParams.set('error', 'AI error. Please try again.')
return new Response(null, { status: 302, headers: { Location: redirectUrl.toString() } })

// Page: render banner when error prop present
{error && <div role="alert" mix={errorBannerStyle}><span>{error}</span></div>}
```

### Validation & Config Constants

| Constant | Value | Effect |
|----------|-------|--------|
| `MAX_MESSAGE_LENGTH` | 5000 | Rejects with 400 |
| `RATE_LIMIT_MS` | 2000 | Rejects with 429 |
| `maxOutputTokens` | 1024 | Truncates LLM response |
| `timeout` | 20000 | Times out LLM call |

### In-Memory Return (N+1 Fix)

`appendMessage` used to call `getConversation()` after UPDATE to return the result. Now constructs the return value in memory. Saves 1 DB query + JSON parse per POST.

## Related

- `concepts/chat-architecture.md` — Architecture and design decisions
- `guides/chat-testing.md` — How to write and run tests
- `core/standards/concepts/code-quality.md` — General optimization patterns
