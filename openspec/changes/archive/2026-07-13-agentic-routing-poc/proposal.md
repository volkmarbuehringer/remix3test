## Why

Agents in web apps today are trapped in the chat-bubble paradigm — every interaction flows through a text stream, even when the user needs to see a calendar, edit a form, or browse paginated data. This forces duplicate UIs (one for direct navigation, one rendered inline by the agent) and makes agents feel like chatbots rather than assistants.

This POC proves a different model: **routes are the agent's tools**. The agent navigates the user to existing routes with query params instead of rendering inline cards. The input bar is a persistent command interface — both expert (type a URL) and assisted (describe intent) paths converge on the same UI.

## What Changes

- **New route** `/route-agent` — a test page with a content frame + persistent input bar, no sidebar
- **New `navigate` tool** on the test agent — emits route events via SSE when the agent decides to navigate
- **New client-side stream handler** — catches `route` events from SSE and navigates the frame
- **New agent instruction** — teaches the agent to use `navigate(path, query?)` for routing requests to existing list routes
- **No changes to existing routes** — `/admin`, `/lists`, and all other routes remain untouched

## Capabilities

### New Capabilities

- `agentic-routing`: The agent can navigate the user to existing routes by calling a `navigate` tool, which emits an SSE `route` event that the client catches to update the frame. The agent does not render UIs — it points at routes.

## Impact

- **New files**: controller, UI page, clientEntry, navigate tool (5 files)
- **Modified files**: testAgent instructions (add navigate tool to tool list + instructions), router.ts (wire new route)
- **No existing routes changed** — zero risk of regressions
- **POC scope is lists only** — agent navigates to `/lists` and `/lists?load=<id>`
