<!-- Context: bookstore-demo/lookup | Priority: high | Version: 1.1 | Updated: 2026-04-14 -->

# AI Tool Patterns

Tool definition, validation, and database access patterns for AI agents.

## Pattern: generateText (NOT doGenerate)

**Common bug**: Using `doGenerate` causes `TypeError: prompt is not iterable`. Use `generateText` instead:

```typescript
// ✅ CORRECT - generateText
let result = await generateText({
  model: provider.chatModel('minimax-m2.7'),
  messages: [{ role: 'user', content: [{ type: 'text', text: systemPrompt }] }],
})

// ❌ WRONG - doGenerate (causes TypeError)
let result = await doGenerate({
  prompt: systemPrompt,  // This fails!
})
```

**Key differences:**
- `generateText` uses `messages` array (like streamText)
- `doGenerate` expects `prompt` string and causes errors

## Pattern: Zod Validation in Tools

```typescript
// location: 1-30 characters
inputSchema: z.object({
  location: z.string().min(1).max(30).describe('The city name (max 30 characters)'),
})

// query: 1-150 characters
inputSchema: z.object({
  query: z.string().min(1).max(150).describe('What the user is looking for (max 150 characters)'),
})
```

## Pattern: Database Access in Tools

```typescript
// 1. Closure variable
let dbInstance: Database | null = null

// 2. Set before agent.generate()
dbInstance = get(Database)

// 3. Access in tool
execute: async ({ query }) => {
  if (!dbInstance) throw new Error('Database not available')
  let allBooks = await dbInstance.findMany(books, { where: { in_stock: true } })
}
```

## Pattern: Tool Result Extraction

```typescript
if (result.steps) {
  for (let step of result.steps) {
    if (step.toolResults) {
      for (let toolResult of step.toolResults) {
        // Check both 'result' and 'output' properties
        let r = (toolResult as { result?: unknown }).result ?? (toolResult as { output?: unknown }).output
        if (r && typeof r === 'object' && 'results' in r) {
          // Process results
        }
      }
    }
  }
}
```

## Codebase References

| Implementation | File |
|----------------|------|
| ToolLoopAgent | `app/controllers/agent/controller.tsx` |
| Streaming | `app/controllers/assistant/controller.tsx` |

## Related

- `lookup/ai-implementation-patterns.md` - Core patterns
- `../development/ai/guides/ai-retry-patterns.md` - Retry logic
