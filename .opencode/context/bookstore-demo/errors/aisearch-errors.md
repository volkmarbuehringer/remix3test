<!-- Context: bookstore-demo/errors | Priority: high | Version: 1.1 | Updated: 2026-04-15 -->

# Errors: AI Book Search Error Handling

**Purpose**: Handle errors gracefully without exposing internal details to users.

**Source**: `bookstore/app/lib/error-logger.ts`

---

## Error Handling Pattern

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
  return render(<AISearchResponsePage books={result.results} />)
} catch (e) {
  errorHandlers.aisearch('Internal error', e)

  let errorMessage = 'An unexpected error occurred. Please try again.'
  if (e instanceof Error) {
    if (e.message.includes('OPENCODE_API_KEY')) {
      errorMessage = 'AI search is not configured. Please set OPENCODE_API_KEY.'
    } else if (e.name === 'AbortError') {
      errorMessage = 'Search timed out. Please try again.'
    } else if (e.message.includes('maxRetriesExceeded')) {
      errorMessage = 'AI service unavailable. Please try again later.'
    }
  }

  return render(<AISearchResponsePage error={errorMessage} />)
}
```

---

## Error Categories

| Error Type | User Message | Log Details |
|-----------|------------|------------|
| Missing API key | "AI search not configured" | Full error |
| Timeout (AbortError) | "Request timed out" | Full error |
| Retry exhausted | "Service unavailable" | All attempts |
| Parse error | "Invalid response" | LLM output |

---

## Input Validation Errors

| Validation | Error Message |
|-----------|--------------|
| Empty query | "Please enter a search query" |
| Query too long | "Query too long (max 500 characters)" |

---

## Security Note

**NEVER expose**:
- Raw error messages to users
- API keys or tokens
- Internal stack traces
- Database details

---

## Related

- `../examples/error-logger-example.md` - Error logging utility
- `../guides/ai-retry-patterns.md` - Retry logic
- `../../development/ai/errors/ai-error-handling.md` - AI error patterns