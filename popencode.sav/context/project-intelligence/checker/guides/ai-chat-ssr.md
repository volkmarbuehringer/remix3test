<!-- Context: project-intelligence/checker/guides | Priority: high | Version: 1.0 | Updated: 2026-04-17 -->

# AI Chat Implementation (SSR Pattern)

**Core Idea**: Pure server-side rendered AI chat using POST-redirect-GET pattern. No client-side JavaScript required—conversation state maintained via URL query parameters and hidden form fields.

**Last Updated**: 2026-04-17

---

## Key Points

- **SSR-First**: All rendering happens server-side; browser only receives HTML
- **POST-redirect-GET**: Form submission → AI processing → redirect to GET with chatId
- **Database-Driven**: Conversation history loaded from PostgreSQL on every request
- **Context Preservation**: `chatId` query parameter + hidden form field maintains state
- **LLM Integration**: OpenCode AI with message history built from database records

---

## Request Flow

```
User submits message
        ↓
POST /chat (with message + optional chatId)
        ↓
Save user message to DB
        ↓
Call LLM with full conversation history
        ↓
Save AI response to DB
        ↓
Redirect to GET /chat?chatId={id}
        ↓
Render page with complete conversation
```

---

## Database Schema

```sql
CREATE TABLE chatlog (
  id SERIAL PRIMARY KEY,
  conversation_id VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL,  -- 'user' | 'assistant'
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## Implementation Pattern

**Controller (GET handler)**:
```typescript
export async function getChat({ request }: RouteContext) {
  const url = new URL(request.url)
  const chatId = url.searchParams.get('chatId')
  
  // Load conversation history from DB
  const messages = chatId 
    ? await getChatMessages(chatId)
    : []
  
  return <ChatPage messages={messages} chatId={chatId} />
}
```

**Controller (POST handler)**:
```typescript
export async function postChat({ request }: RouteContext) {
  const formData = await request.formData()
  const message = formData.get('message')
  const chatId = formData.get('chatId') || generateChatId()
  
  // Save user message
  await saveChatMessage({ conversation_id: chatId, role: 'user', content: message })
  
  // Build LLM history from DB
  const history = await getChatMessages(chatId)
  const aiResponse = await callLLM(history)
  
  // Save AI response
  await saveChatMessage({ conversation_id: chatId, role: 'assistant', content: aiResponse })
  
  // Redirect to GET (Prevents resubmission on refresh)
  return redirect(`/chat?chatId=${chatId}`)
}
```

---

## Environment Configuration

| Variable | Purpose |
|----------|---------|
| `OPENCODE_API_KEY` | API key for OpenCode AI |
| Base URL | `https://opencode.ai/zen/go/v1` |
| Model | `minimax-m2.7` |

---

## Critical Implementation Details

**Message History Building**:
```typescript
const messages = history.map(msg => ({
  role: msg.role,
  content: msg.content
}))
```

**CSS for Line Breaks**: `white-space: pre-wrap` preserves LLM formatting

**Hidden Form Field**: `<input type="hidden" name="chatId" value={chatId} />`

---

## 📂 Codebase References

**Implementation**:
- `checker/app/controllers/chat/controller.tsx` - GET/POST handlers
- `checker/app/controllers/chat/page.tsx` - Server-rendered chat UI
- `checker/app/lib/chatlog.ts` - Database operations
- `checker/app/utils/ai-provider.ts` - AI provider singleton

**Database**:
- `checker/app/data/setup.ts` - Chatlog table creation

**Routing**:
- `checker/app/routes.ts` - Route definition
- `checker/app/router.ts` - Controller mapping

**UI**:
- `checker/app/ui/layout.tsx` - Navigation link

---

## Related

- Remix 3 form patterns: `../../development/remix3/guides/form-patterns.md`
- Database integration: `../../development/data/guides/database-patterns.md`
- SSR concepts: `../../development/fullstack/concepts/ssr-patterns.md`
