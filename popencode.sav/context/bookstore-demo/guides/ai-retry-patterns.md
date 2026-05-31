<!-- Context: bookstore-demo/guides | Priority: high | Version: 1.0 | Updated: 2026-04-10 -->

# Guide: AI Integration with Retry Logic

**Purpose**: Implement robust AI-powered features with retry and exponential backoff.

---

## Pattern Overview

1. **Validate API key** at startup (fail fast if missing)
2. **Build prompt** from user query + available data
3. **Execute with retry** - 3 attempts, exponential backoff
4. **Parse response** - extract JSON from LLM output
5. **Return results** with error handling

---

## Implementation

### Step 1: API Key Validation

```typescript
function validateAPIKey(): string {
  let apiKey = process.env.OPENCODE_API_KEY
  if (!apiKey) {
    throw new Error('OPENCODE_API_KEY environment variable is not set')
  }
  return apiKey
}
```

### Step 2: Retry with Exponential Backoff

```typescript
let maxRetries = 3
for (let attempt = 1; attempt <= maxRetries; attempt++) {
  try {
    let result = await generateText({ model, prompt })
    return result
  } catch (error) {
    lastError = error instanceof Error ? error : new Error(String(error))
    console.error(`Attempt ${attempt} failed:`, lastError.message)

    if (attempt < maxRetries) {
      let delay = Math.pow(2, attempt - 1) * 1000 // 1s, 2s, 4s
      await new Promise((resolve) => setTimeout(resolve, delay))
    }
  }
}
throw lastError || new Error('AI search failed after retries')
```

### Step 3: Debug Logging

```typescript
console.log('[AI Book Search] === DEBUG: LLM INPUT ===')
console.log('[AI Book Search] Book catalog preview (first 500 chars):')
console.log(bookCatalog.slice(0, 500))
console.log('[AI Book Search] System prompt:')
console.log(systemPrompt)
console.log('[AI Book Search] === END DEBUG ===')
```

---

## Best Practices

- **Always validate** API key at function start
- **Log LLM input** for debugging prompts
- **Use exponential backoff** (not linear) to handle rate limits
- **Limit results** to prevent large responses
- **Catch specific errors** - AbortError for timeouts

---

## Related

- [per-tool-timeouts.md](per-tool-timeouts.md) - Per-tool timeout patterns
- concepts/ai-book-search.md
- errors/aisearch-errors.md
- lookup/database-filtering-patterns.md