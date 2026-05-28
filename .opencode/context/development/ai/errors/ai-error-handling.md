<!-- Context: development/ai/errors | Priority: high | Version: 1.1 | Updated: 2026-04-15 -->

# AI Error Handling

**Purpose**: Handle AI errors gracefully without exposing internal details.

**Source**: `bookstore/app/lib/error-logger.ts`

---

## Pattern

**ALWAYS**:
- Catch errors with context
- Log detailed errors server-side
- Return user-friendly messages
- Never expose raw error details

---

## Implementation

```typescript
import { errorHandlers } from '../lib/error-logger'

try {
  let result = await searchBooksAI(query, db)
  return { books: result.results }
} catch (e) {
  errorHandlers.aisearch('Internal error', e)

  let errorMessage = 'An unexpected error occurred.'
  if (e instanceof Error) {
    if (e.message.includes('OPENCODE_API_KEY')) {
      errorMessage = 'AI search not configured.'
    } else if (e.name === 'AbortError') {
      errorMessage = 'Request timed out.'
    }
  }
  return { error: errorMessage }
}
```

---

## Error Categories

| Error | User Message | Action |
|-------|-------------|--------|
| Missing API key | "AI not configured" | Check env vars |
| Timeout | "Request timed out" | Retry |
| Retry exhausted | "Service unavailable" | Wait and retry |
| Parse error | "Invalid response" | Log LLM output |

---

## Security Note

**NEVER expose**:
- Raw error messages to users
- API keys or tokens
- Internal stack traces
- Database details

---

## Related

- `../../bookstore-demo/examples/error-logger-example.md` - Error logging utility
- `../guides/ai-retry-patterns.md` - Retry logic
- `../guides/per-tool-timeouts.md` - Timeout patterns
