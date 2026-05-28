<!-- Context: project-intelligence/my_app/concepts | Priority: high | Version: 1.1 | Updated: 2026-05-10 -->

# Concept: Messages Architecture

**Core Idea**: A realtime message board composed of three Remix 3 patterns — a page shell with `<Frame>`, an SSE endpoint for live updates, and a clientEntry component that bridges them. Each pattern handles a distinct concern; they communicate through the DOM, not shared state.

## Architecture

```
/messages  (GET + POST)        → Page shell controller (directory)
  └─ Layout + <Frame src="/messages/content">
/messages/content  (GET)       → Fragment controller (flat, named export)
  └─ SSR message list + form + <MessagesClient>
/messages/subscribe  (GET, SSE) → SSE controller (flat, named export)
  └─ ReadableStream, broadcastInvalidate()

## Data Flow

```
  POST /messages (form submit)
    → controller.tsx: sanitize → db.create() → broadcastInvalidate()
    → sseClients.forEach (safe iteration: collect dead, then delete)
    → MessagesClient (EventSource 'invalidate' event)
    → fetchPage() re-fetches content
```

## Key Design Decisions

| Decision | Why |
|----------|-----|
| **Separate fragment route** | Frame loads `/messages/content` independently — no `x-remix-target` header needed (v2 pattern) |
| **Module-level SSE state** | `sseClients` Set + rate limiter Map live in `messages-sse.ts` — no DB polling |
| **clientEntry returns `null`** | Side-effect-only component — prepends DOM nodes on SSE events, no re-render lifecycle |
| **Flat files for single-action routes** | `messages-content.tsx` and `messages-subscribe.tsx` are flat `export const` — no controller directory needed |
| **Directory controller for multi-action** | `messages/controller.tsx` houses both `index` (GET) and `action` (POST) |

## Codebase References

- Route definitions: `my_app/app/routes.ts` (lines 13-18)
- Router wiring: `my_app/app/router.ts` (lines 68-70)
- Page shell: `my_app/app/actions/messages/controller.tsx`
- Frame + Layout: `my_app/app/actions/messages/page.tsx`
- Fragment UI: `my_app/app/actions/messages/fragment-page.tsx`
- Fragment handler: `my_app/app/actions/messages-content.tsx`
- SSE endpoint: `my_app/app/actions/messages-subscribe.tsx`
- SSE module: `my_app/app/lib/messages-sse.ts`
- clientEntry: `my_app/app/assets/messages-client.ts`

## Related

- `development/remix3/guides/frames.md` — Frame basics
- `development/remix3/guides/frame-resolution.md` — v2 resolveFrame
- `development/remix3/guides/sse-implementation.md` — Generic SSE patterns
- `project-intelligence/my_app/concepts/architecture.md` — Base app conventions
- `project-intelligence/my_app/guides/messages-with-frames.md` — How-to guide
- `project-intelligence/frames/` — Known frame errors and gotchas
