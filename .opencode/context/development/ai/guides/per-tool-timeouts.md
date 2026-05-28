<!-- Context: development/ai/guides | Priority: high | Version: 1.0 | Updated: 2026-04-11 -->

# Per-Tool Timeout Pattern

**Purpose**: Implement tool-specific timeouts using AbortController for AI agent tools.

---

## Overview

Different tools have different operational characteristics:
- External API calls (weather, Wikipedia) → shorter timeouts
- Database + LLM operations (book search) → longer timeouts

**Solution**: Per-tool timeout with AbortController.

---

## Timeout Values

| Tool | Timeout | Reason |
|------|---------|--------|
| `get_weather` | 10s | External API + geocoding |
| `search_wikipedia` | 8s | External API |
| `search_books` | 15s | DB query + LLM |

---

## Implementation

```typescript
tool({
  inputSchema: z.object({ ... }),
  execute: async ({ params }) => {
    let controller = new AbortController()
    let timeout = setTimeout(() => controller.abort(), TIMEOUT_MS)

    try {
      return await someOperation(..., { signal: controller.signal })
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Specific timeout message')
      }
      throw error
    } finally {
      clearTimeout(timeout)
    }
  },
})
```

---

## Per-Tool vs Global Timeout

| Aspect | Per-Tool | Global |
|--------|----------|--------|
| Granularity | Individual tools | Entire request |
| Flexibility | Different values | Single value |
| Use case | Mixed (API, DB, LLM) | Homogeneous |

**Use per-tool when**: Mix of fast/slow operations, need different failure messages.

---

## Key Points

1. **Always pass signal** to fetch/async operations
2. **Use try/finally** to clear timeout and prevent memory leaks
3. **Catch AbortError** specifically for timeouts
4. **User-friendly messages** - include timeout duration in error

---

## Related

- `ai-retry-patterns.md` - Retry for transient failures
- `ai-error-handling.md` - Error handling
