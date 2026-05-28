<!-- Context: bookstore-demo/guides | Priority: high | Version: 1.0 | Updated: 2026-04-11 -->

# Guide: Per-Tool Timeout Pattern for AI Agents

**Purpose**: Implement tool-specific timeouts using AbortController for AI agent tools.

---

## Overview

When building AI agents with multiple tools, each tool may have different operational characteristics:
- External API calls (weather, Wikipedia) need shorter timeouts
- Database + LLM operations (book search) need longer timeouts
- Global timeouts are too coarse-grained

**Solution**: Per-tool timeout configuration with AbortController.

---

## Timeout Values by Tool

| Tool | Timeout | Reason |
|------|---------|--------|
| `get_weather` | 10s | External API (Open-Meteo) + geocoding |
| `search_wikipedia` | 8s | External API (Wikipedia) |
| `search_books` | 15s | DB query + LLM processing |

---

## Implementation Pattern

### Basic Structure

```typescript
tool({
  inputSchema: z.object({ ... }),
  execute: async ({ params }) => {
    // Create abort controller and timeout
    let controller = new AbortController()
    let timeout = setTimeout(() => controller.abort(), TIMEOUT_MS)

    try {
      // Pass signal to fetch/async operations
      let result = await someOperation(..., { signal: controller.signal })
      return result
    } catch (error) {
      // Check if this is a timeout (AbortError)
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Specific timeout message')
      }
      throw error
    } } finally {
      // Always clear timeout to prevent memory leaks
      clearTimeout(timeout)
    }
  },
})
```

### Complete Example (get_weather)

```typescript
get_weather: tool({
  description: 'Get current weather for a location worldwide',
  inputSchema: z.object({
    location: z.string().min(1).max(30),
  }),
  execute: async ({ location }) => {
    // 10s timeout
    let controller = new AbortController()
    let timeout = setTimeout(() => controller.abort(), 10000)

    try {
      // First call: geocoding
      let geoResponse = await fetch(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(location)}&count=1`,
        { signal: controller.signal }
      )
      
      if (!geoResponse.ok) throw new Error('Geocoding failed')
      
      let geoData = await geoResponse.json()
      if (!geoData.results?.length) throw new Error(`Location "${location}" not found`)
      
      // Second call: weather
      let weatherResponse = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${geoData.results[0].latitude}&...`,
        { signal: controller.signal }
      )
      
      let weatherData = await weatherResponse.json()
      return {
        location: geoData.results[0].name,
        temperature: Math.round(weatherData.current.temperature_2m),
        condition: getWeatherCondition(weatherData.current.weather_code),
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Weather request timed out')  // User-friendly message
      }
      throw error
    } finally {
      clearTimeout(timeout)
    }
  },
})
```

### Example with Multiple Operations (search_books)

```typescript
search_books: tool({
  execute: async ({ query }) => {
    // 15s timeout (longer for DB + LLM)
    let controller = new AbortController()
    let timeout = setTimeout(() => controller.abort(), 15000)

    try {
      // DB query
      let db = getDb()
      let allBooks = await db.findMany(books, { where: { in_stock: true } })

      // LLM call
      let result = await provider.chatModel('minimax-m2.7').doGenerate({
        prompt: buildPrompt(query, allBooks),
      })

      return parseResults(result.text)
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Book search timed out after 15 seconds')
      }
      throw new Error('Book search failed')
    } finally {
      clearTimeout(timeout)
    }
  },
})
```

---

## Per-Tool vs Global Timeout

| Aspect | Per-Tool Timeout | Global Timeout |
|--------|-----------------|----------------|
| **Granularity** | Individual tools | Entire request |
| **Flexibility** | Different values per operation | Single value |
| **Use case** | Mixed tool types (API, DB, LLM) | Homogeneous operations |
| **Failure isolation** | One tool fails, others continue | Entire request fails |
| **Complexity** | More setup, more control | Simple, coarse |

**When to use per-tool**:
- Mix of fast (API) and slow (DB+LLM) operations
- Want different failure messages per operation
- Need to prioritize certain tools over others

**When to use global**:
- All operations have similar duration
- Simple use case, don't need granularity
- Request-level timeout is sufficient

---

## Key Points

1. **Always pass signal** to fetch/async operations - without it, AbortController does nothing
2. **Use try/finally** - clear timeout even on error to prevent memory leaks
3. **Catch AbortError specifically** - other errors should propagate normally
4. **User-friendly messages** - include timeout duration in error message
5. **Test timeouts** - verify the timeout actually fires, not the operation

---

## Related

- [ai-retry-patterns.md](ai-retry-patterns.md) - Retry logic for transient failures
- [aisearch-errors.md](../errors/aisearch-errors.md) - Error handling patterns
- Code: `bookstore/app/controllers/agent/controller.tsx`