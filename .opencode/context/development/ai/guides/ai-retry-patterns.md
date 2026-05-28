<!-- Context: development/ai/guides | Priority: high | Version: 1.0 | Updated: 2026-04-11 -->

# AI Integration with Retry Logic

**Purpose**: Implement robust AI features with retry and exponential backoff.

---

## Pattern

1. **Validate API key** at startup (fail fast)
2. **Build prompt** from user query + data
3. **Execute with retry** - 3 attempts, exponential backoff
4. **Parse response** - extract JSON from LLM output
5. **Return results** with error handling

---

## Implementation

### API Key Validation
```typescript
function validateAPIKey(): string {
  let apiKey = process.env.OPENCODE_API_KEY
  if (!apiKey) throw new Error('OPENCODE_API_KEY not set')
  return apiKey
}
```

### Retry with Exponential Backoff
```typescript
let maxRetries = 3
for (let attempt = 1; attempt <= maxRetries; attempt++) {
  try {
    return await generateText({ model, prompt })
  } catch (error) {
    if (attempt < maxRetries) {
      let delay = Math.pow(2, attempt - 1) * 1000 // 1s, 2s, 4s
      await new Promise((resolve) => setTimeout(resolve, delay))
    }
  }
}
throw new Error('AI search failed after retries')
```

---

## Best Practices

- **Always validate** API key at function start
- **Log LLM input** for debugging prompts
- **Use exponential backoff** (not linear) for rate limits
- **Limit results** to prevent large responses
- **Catch specific errors** - AbortError for timeouts

---

## Related

- `per-tool-timeouts.md` - Timeout patterns
- `ai-error-handling.md` - Error handling
