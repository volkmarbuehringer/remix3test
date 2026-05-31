<!-- Context: development/ai/concepts | Priority: high | Version: 1.0 | Updated: 2026-04-11 -->

# AI-Powered Book Search

**Core Idea**: Integrate LLM into book search for natural language queries with AI reasoning for recommendations.

---

## Key Points

- **LLM Integration**: OpenCode API via `@ai-sdk/openai-compatible`
- **Retry Logic**: 3 attempts with exponential backoff (1s, 2s, 4s)
- **Result Limit**: 5 books max per search
- **Query Validation**: max 500 characters
- **Database Filtering**: description > 100 chars, valid titles

---

## Quick Example

```typescript
// Retry with exponential backoff
for (let attempt = 1; attempt <= maxRetries; attempt++) {
  try {
    let result = await generateText({ model, prompt: systemPrompt })
    return result
  } catch (error) {
    if (attempt < maxRetries) {
      let delay = Math.pow(2, attempt - 1) * 1000
      await new Promise((resolve) => setTimeout(resolve, delay))
    }
  }
}
```

---

## Related

- `../guides/ai-retry-patterns.md` - Retry with backoff
- `../guides/per-tool-timeouts.md` - Timeout patterns
- `../errors/ai-error-handling.md` - Error handling
