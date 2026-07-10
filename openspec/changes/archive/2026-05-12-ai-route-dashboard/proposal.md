## Why

The Chat and Agent features are currently top-level routes at `/chat` and `/agent`, placing them alongside structural routes like Home, Auth, and Admin. As the AI surface grows, these routes need a dedicated home — an AI dashboard with a sidebar layout (mirroring the admin pattern) that groups AI features together under `/ai/`. This creates a scalable foundation for future AI capabilities (e.g., AI settings, prompt library, usage analytics).

## What Changes

- **BREAKING**: Chat and Agent routes move from `/chat` and `/agent` to `/ai/chat` and `/ai/agent`. Old URLs return 404.
- Add a new AI dashboard index page at `/ai` with an overview of available AI features
- Add a new `ai-layout.tsx` with sidebar navigation (frame-based, like admin) for the AI section
- Add a new `ai-controller.tsx` for the AI dashboard index
- Update route definitions in `routes.ts` to nest chat and agent under an `ai` prefix
- Update navigation in `nav.ts` — point Chat/Agent to `/ai/chat`, `/ai/agent`, add AI Dashboard link
- Update all redirect URLs in chat and agent controllers (from `/chat` → `/ai/chat`, `/agent` → `/ai/agent`)
- Update chatlog page links from `/chat?chatId=` and `/agent?agentId=` to `/ai/chat?chatId=` and `/ai/agent?agentId=`
- **No breaking changes to storage or data models** — routes only

## Capabilities

### New Capabilities

- `ai-route-dashboard`: AI section under `/ai/` with a dashboard index page and sidebar layout for organizing AI features

### Modified Capabilities

_(None — no existing specs are changing)_

## Impact

- **URL changes**: `/chat` → `/ai/chat`, `/agent` → `/ai/agent` — affects bookmarks and external links
- **Affected files**:
  - `app/routes.ts` — restructure aiRoutes to nest under `ai` prefix
  - `app/router.ts` — map aiRoutes differently, one controller per route
  - `app/actions/chat-controller.tsx` — update redirect URLs
  - `app/actions/agent-controller.tsx` — update redirect URLs
  - `app/ui/chat-page.tsx` — update form action URL
  - `app/ui/agent-page.tsx` — update form action URL
  - `app/ui/admin-chatlog-page.tsx` — update links to chat/agent
  - `app/ui/nav.ts` — update hrefs
- **New files**:
  - `app/ui/ai-layout.tsx` — AI sidebar layout (mirrors admin-layout)
  - `app/ui/ai-page.tsx` — AI dashboard index page
  - `app/actions/ai-controller.tsx` — AI dashboard controller
- **Not affected**: database, sessions, middleware, auth, types/context
