<!-- Context: development/remix3/guides/frame-based-chat | Priority: high | Version: 1.0 | Updated: 2026-04-11 -->

# Frame-Based Chat

Frame-based LLM chat implementation using server-side rendering with CSS via HTML fragments.

## Overview
The `/chat` route renders LLM responses via Frame fragments, providing server-side styling without client-side JS bundling for content. This differs from the client-side `/assistant` route which handles everything in the browser.

## Architecture
```
User Message (client) → POST /chat action → LLM generates response → Return Frame URL → Client loads Frame → Server renders HTML + CSS → Client displays rendered content
```

## Route Setup
```typescript
chat: route('chat', { index: get('/'), action: post('/') }),
```

## Chat Controller
```typescript
export default {
  actions: {
    async index() { return render(<ChatPage />) },
    async action({ get }) {
      let formData = get(FormData); let { message } = parse(messageSchema, formData)
      let result = streamText({ model: provider.chatModel('minimax-m2.7'), prompt: message })
      let responseText = await result.text()
      let encoded = encodeURIComponent(responseText)
      let frameUrl = `/fragments/llm-message?message=${encoded}&role=assistant&timestamp=${timestamp}`
      return Response.json({ frameUrl, timestamp })
    },
  },
}
```

## Fragment Controller
```typescript
export default {
  actions: {
    llmMessage() {
      let url = new URL(context.request.url)
      let message = url.searchParams.get('message') ?? ''
      let role = url.searchParams.get('role') ?? 'assistant'
      let error = url.searchParams.get('error') === 'true'
      return renderFragment(<li mix={[css({ padding: '0.75rem', background: error ? '#ffebee' : '#f5f5f5' })]}><div>{message}</div></li>)
    },
  },
}
```

## URL Encoding Pattern
```typescript
let encodedMessage = encodeURIComponent(llmResponse)
let frameUrl = `/fragments/llm-message?message=${encodedMessage}&...`
let message = url.searchParams.get('message') ?? ''
```
Handles newlines (\n → %0A), special characters, Unicode text, and empty strings.

## Client Component
```typescript
export const ChatInterface = clientEntry(moduleUrl, (handle) => { return () => (<Frame src={msg.frameUrl} fallback={<span>Loading...</span>} />) })
```

## When to Use Frame-Based Rendering
| Scenario | Recommendation |
|----------|---------------|
| Complex formatting with CSS | Frame ✓ |
| Simple text-only responses | Client-side |
| Need server-side styling | Frame ✓ |
| Real-time streaming | SSE + client-side |
| Maximum performance | Client-side |
| SEO for public content | Frame ✓ |

## Trade-offs
| Pros | Cons |
|------|------|
| Server-side CSS (no JS bundle) | Extra HTTP round-trip |
| Works without JavaScript | More server load |
| Consistent styling | URL length limits |
| SEO-friendly content | Encoding overhead |

## Key Techniques
1. **encodeURIComponent()** - Must encode all LLM response text
2. **Query params** - Pass data through URL, not response body
3. **renderFragment()** - Returns HTML + inline styles
4. **Frame component** - Client loads and displays fragment

## Related
- `guides/frame-resolution.md` - Frame resolution mechanics
- `examples/cart-button-pattern.md` - Similar fragment pattern
- `concepts/client-side-chat-log.md` - Client-side alternative
- `lookup/chat-log-aria.md` - Accessibility patterns

## Codebase References
**Implementation**: `bookstore/app/assets/chat-interface.tsx`, `bookstore/app/controllers/chat/controller.tsx`, `bookstore/app/controllers/chat/page.tsx`, `bookstore/app/controllers/fragments/controller.tsx`, `bookstore/app/routes.ts`
