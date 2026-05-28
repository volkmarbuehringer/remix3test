<!-- Context: project-intelligence/my_app/concepts | Priority: high | Version: 1.0 | Updated: 2026-05-02 -->

# Concept: Chat Route Architecture

**Purpose**: SSR-based chat using Remix 3 form POST + redirect pattern with optimistic concurrency, rate limiting, and error surfacing via query params.

## Core Idea

Chat is built as a classic SSR request-response flow (no Frames/SSE) — a directory controller handles GET (render page with conversation history) and POST (validate → LLM → append → redirect). The DB layer uses optimistic concurrency to prevent race conditions on concurrent message appends.

## Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| **SSR over streaming** | Chat is request-response, not realtime broadcast. No Frames/SSE. Simpler, fewer moving parts. |
| **`generateText` over `streamText`** | Response is always fully buffered before redirect. Eliminates streaming infrastructure overhead. |
| **In-memory return** | `appendMessage` returns constructed result instead of re-fetching from DB (saves 1 DB round-trip per POST). |
| **Optimistic concurrency** | `WHERE jsonb_array_length(conversation) = $len` guards concurrent writes; re-fetches on mismatch. |
| **Module-level rate limit** | `lastChatTime` global rejects requests within 2s (429). Simple, no external dependency. |
| **Error via query param** | LLM failures redirect with `?error=` param; GET handler passes it to page for banner display. |

## Data Flow

```
POST /chat
  → validate (empty/too-long checks)
  → rate limit check (2s window)
  → createConversation() or reuse existing
  → generateText() — LLM call
  → appendMessage(user) + appendMessage(assistant) — optimistic concurrency
  → redirect to /chat?chatId=xxx

GET /chat
  → loadConversation() from DB
  → render ChatPage with messages + optional error banner
  → hidden <input name="conversationId"> for subsequent POSTs
```

## Key Points

- Directory controller (`chat/controller.tsx`) with `index` (GET) and `action` (POST)
- Page component (`chat/page.tsx`) is SSR-only — no client JS needed for chat to work
- Three test layers: real DB (chatlog.test.ts), router integration (controller.test.ts), VDOM (page.test.ts)

## Codebase References

**Business Logic**:
- `my_app/app/actions/chat/controller.tsx` — GET/POST handlers with rate limiting, validation, LLM orchestration
- `my_app/app/lib/chatlog.ts` — DB layer with optimistic concurrency, in-memory return

**Implementation**:
- `my_app/app/actions/chat/page.tsx` — ChatPage component with error banner, empty state, message badges

**Tests**:
- `my_app/app/lib/chatlog.test.ts` — 11 real DB tests
- `my_app/app/actions/chat/controller.test.ts` — 6 router integration tests
- `my_app/app/actions/chat/page.test.ts` — 8 component tests

## Related

- `concepts/architecture.md` — Base app conventions
- `concepts/messages-architecture.md` — Alternative: Frame + SSE approach for realtime features
- `lookup/chat-patterns.md` — Quick reference for patterns
- `guides/chat-testing.md` — How to write and run tests
