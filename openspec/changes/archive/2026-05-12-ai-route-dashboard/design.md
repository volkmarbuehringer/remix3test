## Context

Currently Chat and Agent are top-level routes at `/chat` and `/agent`, mapped directly from `aiRoutes` in `router.ts`. They render inside the main `Layout` without any AI-specific navigation. The admin area demonstrates the preferred pattern: routes nested under a prefix (`admin/`), a sidebar layout with frame-based navigation, a dashboard index page, and per-route controllers.

This change adopts that same pattern for AI features. The `admin-layout.tsx` pattern serves as the design template — a sticky sidebar with nav groups, active state highlighting, an icon system, and frame-based navigation for partial page updates.

## Goals / Non-Goals

**Goals:**
- Nest Chat and Agent under `/ai/` prefix: `/ai/chat` and `/ai/agent`
- Add an AI dashboard index page at `/ai` with overview cards (like admin dashboard)
- Create an `ai-layout.tsx` with sidebar navigation (same pattern as admin)
- Frame-based navigation within the AI section (same `X-Remix-Frame` / `X-Remix-Target` pattern)
- Update all internal links and redirects to point to new URLs
- Keep existing Chat and Agent controllers functional (same logic, new URL space)

**Non-Goals:**
- No changes to chat/agent controller logic, data storage, or middleware
- No new AI features (settings, prompt library, etc.) — just restructuring
- No auth changes (chat/agent remain unprotected, admin auth remains separate)
- No CSS theme changes
- No database schema changes

## Decisions

**Decision 1: Mirror admin layout pattern exactly**
- The admin layout (`admin-layout.tsx`) is a proven pattern: sticky sidebar, `AdminShellOrFragment` component that detects frame requests, nav groups with icons, active state highlighting. The AI layout will follow the same structure.
- File naming: `ai-layout.tsx`, `ai-page.tsx`, `ai-controller.tsx` (mirrors `admin-layout.tsx`, `admin-page.tsx`, `admin-controller.tsx`)

**Decision 2: Route structure uses nested route under `ai` prefix**

```ts
export const aiRoutes = route({
  ai: route('ai', {
    index: get('/'),
    chat: route('chat', {
      index: get('/'),
      action: post('/'),
    }),
    agent: route('agent', {
      index: get('/'),
      action: post('/'),
    }),
  }),
})
```

This maps to:
- `/ai` — dashboard
- `/ai/chat` — chat interface
- `/ai/agent` — agent interface

**Decision 3: Use a `frames` object for AI frame navigation**
- Define `aiContent: 'ai-content'` alongside existing `adminContent` in `routes.ts`
- AI layout uses `<Frame name={frames.aiContent} src={...}>` same as admin

**Decision 4: Router maps aiRoutes differently**
- Currently `router.map(aiRoutes.chat, chatController)` and `router.map(aiRoutes.agent, agentController)` — these map top-level routes
- After the change: `router.map(aiRoutes.ai, aiController)` for the dashboard, and `router.map(aiRoutes.ai.chat, chatController)` and `router.map(aiRoutes.ai.agent, agentController)` for nested routes

**Alternative considered:** Leaving chat/agent at top level and adding a dashboard redirect. Rejected — the whole point is to establish `/ai/` as the canonical home for AI features.

**Alternative considered:** Adding permanent redirects from old `/chat` and `/agent` to new paths. Rejected — intentionally removing old paths.

## Risks / Trade-offs

- **[Low] URL breakage** — Existing bookmarks to `/chat` and `/agent` will 404. This is intentional — old paths are removed.
- **[Low] Chatlog page links** — Admin chatlog page links to conversations with `/chat?chatId=X` and `/agent?agentId=X` — these need updating to `/ai/chat?chatId=X` and `/ai/agent?agentId=X`.
- **[Low] Chat form action** — The chat form in `chat-page.tsx` uses `aiRoutes.chat.action.href()` which will automatically resolve to the new URL since it references the route object — no hardcoded URLs.
- **[Low] Agent form action** — Same as chat, uses `aiRoutes.agent.action.href()` — auto-resolves.
