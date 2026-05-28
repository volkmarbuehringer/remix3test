<!-- Context: bookstore-demo/concepts | Priority: high | Version: 1.0 | Updated: 2026-04-10 -->

# Concept: AI-Powered Book Search

**Core Idea**: Integrate LLM (OpenCode API with minimax-m2.7 model) into book search for natural language queries, displaying AI reasoning for each recommendation.

---

## Key Points

- **Route**: `/aisearch` - new GET/POST endpoint in controller structure
- **LLM Integration**: OpenCode API via `@ai-sdk/openai-compatible`
- **Retry Logic**: 3 attempts with exponential backoff (1s, 2s, 4s)
- **Result Limit**: 5 books max per search
- **Query Validation**: max 500 characters
- **Database Filtering**: description > 100 chars, title not starting with "Test"

---

## Quick Example

```typescript
// Retry with exponential backoff in ai-book-search.ts
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

## Implementation Files

| File | Purpose |
|------|---------|
| `bookstore/app/utils/ai-book-search.ts` | Core AI search logic with retry |
| `bookstore/app/controllers/aisearch/controller.tsx` | GET/POST handlers |
| `bookstore/app/controllers/aisearch/page.tsx` | Page components |
| `bookstore/app/ui/book-search-card.tsx` | Result card UI |

---

## Related

- guides/ai-retry-patterns.md
- examples/ai-book-search-ui.md
- errors/aisearch-errors.md