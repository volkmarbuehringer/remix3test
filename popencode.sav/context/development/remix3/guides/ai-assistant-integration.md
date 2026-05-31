<!-- Context: development/remix3/guides/ai-assistant-integration | Priority: high | Version: 2.2 | Updated: 2026-04-12 -->

# AI Assistant Integration

Integrate OpenCode's minimax-m2.7 model as an AI assistant in Remix 3.

## Core Concept (1-3 sentences)

Set up a chat interface using OpenCode API with SSE streaming. The controller handles form input, calls the LLM, and renders the response. Tool calling is saved but returns "invalid params" error.

---

## Key Points

- **API**: `https://opencode.ai/zen/go/v1/messages` with `x-api-key` header
- **Model**: `minimax-m2.7`, streaming via SSE
- **Flow**: Form → Controller → LLM call → Response page
- **Tool calling**: Not working (API returns invalid_params)
- **Env**: Set `OPENCODE_API_KEY` in `.env`

---

## Minimal Example

```typescript
// bookstore/app/utils/llm/opencode.ts
export async function* chatCompletion({
  model = 'minimax-m2.7',
  messages,
  systemPrompt,
}: {
  model?: string
  messages: { role: 'user' | 'assistant'; content: string }[]
  systemPrompt?: string
}) {
  let body = {
    model,
    messages: systemPrompt
      ? [{ role: 'system', content: systemPrompt }, ...messages]
      : messages,
    stream: true,
  }

  let response = await fetch('https://opencode.ai/zen/go/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.OPENCODE_API_KEY!,
    },
    body: JSON.stringify(body),
  })

  // Parse SSE stream, yield { type: 'text_delta', text: string }
}
```

---

## Directory Structure

```
bookstore/app/
├── utils/llm/opencode.ts     # Direct API calls (working)
├── utils/llm/tool-calling.ts # Tool calling (not working)
└── controllers/assistant/
    ├── controller.tsx        # Form handling + LLM calls
    └── page.tsx              # UI components
```

---

## Known Issues

- **Tool calling**: Returns `invalid_request_error: invalid params` - use system prompts instead

---

## Reference

- API Docs: https://opencode.ai/zen/go
- Form patterns: `guides/form-patterns.md`
- Related error: `errors/body-unusable.md`

---

## Codebase References

- Implementation: `bookstore/app/utils/llm/opencode.ts`
- Controller: `bookstore/app/controllers/assistant/controller.tsx`
- UI: `bookstore/app/controllers/assistant/page.tsx`
