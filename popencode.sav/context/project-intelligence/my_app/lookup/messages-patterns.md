<!-- Context: project-intelligence/my_app/lookup | Priority: medium | Version: 1.0 | Updated: 2026-05-01 -->

# Lookup: Messages Pattern Reference

## Route Table

| Route Name | Path | Method | File | Type |
|---|---|---|---|---|
| `messages` | `/messages` | GET+POST | `app/actions/messages/controller.tsx` | Directory (multi-action) |
| `messagesContent` | `/messages/content` | GET | `app/actions/messages-content.tsx` | Flat (single-action, named export) |
| `messagesSubscribe` | `/messages/subscribe` | GET | `app/actions/messages-subscribe.tsx` | Flat (single-action, named export) |

## Key Files

| File | Purpose |
|---|---|
| `app/actions/messages/page.tsx` | Layout + `<Frame>` component |
| `app/actions/messages/fragment-page.tsx` | Fragment UI: SSR message list, form, `<MessagesClient>` |
| `app/lib/messages-sse.ts` | Module-level SSE client Set, broadcast, rate limiter |
| `app/assets/messages-client.ts` | clientEntry: EventSource + form intercept |
| `app/utils/render.tsx` | render, renderFragment, resolveClientEntry |

## Quick Patterns

| What | How |
|---|---|
| **Add a new Frame feature** | 1) Add fragment route + flat controller 2) Render `<Frame>` in parent page shell 3) Optional: clientEntry for interactivity |
| **Add SSE to a Frame** | 1) Create SSE module with `sseClients` Set 2) SSE endpoint controller 3) clientEntry connects EventSource |
| **clientEntry wrapper** | `clientEntry(import.meta.url, fn(handle) => (props) => { /* side effects */ return null })` |
| **File:// vs path-based clientEntry** | `resolveClientEntry` checks `startsWith('file://')` for asset server, else uses path as-is |

## Dependencies

- **DB tables**: `messages` (id, sender_id, content, created_at), `users` (for JOIN)
- **Seed order**: Users must be seeded before messages (FK `sender_id`)
- **Auth**: User must be logged in (middleware on page shell, inline checks on fragment/SSE)

## Related

- `concepts/messages-architecture.md`
- `guides/messages-with-frames.md`
- `concepts/architecture.md` — Base conventions (route mapping, middleware)
- `development/remix3/lookup/patterns.md`
- `project-intelligence/frames/lookup/frame-vs-client-entry.md`
