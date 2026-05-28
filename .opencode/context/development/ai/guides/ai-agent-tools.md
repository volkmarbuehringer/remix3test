<!-- Context: development/ai/guides/ai-agent-tools | Priority: high | Version: 1.0 | Updated: 2026-04-11 -->

# AI Agent Tool Examples

Working examples of tools for AI agents.

## Weather Tool (Open-Meteo)

```typescript
async function fetchWeather(location: string) {
  // 1. Geocode
  let { latitude, longitude, name, country } = (await (await fetch(
    `https://geocoding-api.open-meteo.com/v1/search?name=${location}&count=1`
  )).json()).results[0]

  // 2. Weather
  let { temperature_2m, weather_code } = (await (await fetch(
    `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weather_code`
  )).json()).current

  return { location: `${name}, ${country}`, temperature: Math.round(temperature_2m), condition: weatherCode }
}
```

## Tool with Database Access

Tools access Remix DataTable `Database` via execution context:

```typescript
search_books: tool({
  inputSchema: z.object({ query: z.string().describe('What the user wants') }),
  execute: async (input: { query: string }, context: { get: (token: typeof Database) => unknown }) => {
    let db = context.get(Database) as InstanceType<typeof Database>
    let books = await db.findMany(books, { where: { in_stock: true } })
    // ...
  },
}),
```

## Book Search Tool (AI-Powered)

Uses `generateText` within tool for semantic search:

```typescript
search_books: tool({
  inputSchema: z.object({ query: z.string() }),
  execute: async (input, context) => {
    let db = context.get(Database)
    let allBooks = await db.findMany(books, { where: { in_stock: true } })

    let bookCatalog = allBooks.map((b) => `- ${b.title}: ${b.description?.slice(0, 200)}`).join('\n')

    let result = await generateText({
      model: provider.chatModel('minimax-m2.7'),
      prompt: `Find books matching: "${input.query}"\n\nAvailable:\n${bookCatalog}`,
      temperature: 0.3,
    })

    let matches = JSON.parse(result.text.match(/\[[\s\S]*\]/)?.[0] ?? '[]')
    return { query: input.query, results: matches }
  },
}),
```

## Best Practices

- **Tool descriptions**: Include JSON input format examples
- **Temperature**: Use `0.3` for consistent matching
- **Book catalog**: Truncate descriptions to ~200 chars
- **External APIs**: Use Open-Meteo (free, no API key), add timeouts

## Related

- `vercel-ai-sdk-agent.md` - Core agent setup
- `per-tool-timeouts.md` - Timeout patterns
