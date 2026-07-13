## Why

Three usability issues with the agent UIs:

1. **Route-agent is hidden** — unlike the Support-Agent and Test-Agent, the Route-Agent has no entry in the admin sidebar. Users must know the URL `/route-agent` to access it.
2. **Route-agent has no scrollable message log** — text streams into a thin status bar (`#agent-bar`, max 3rem) instead of a scrollable history like all other agents. Messages are ephemeral and conversational context is lost.
3. **Route-agent page is too tall** — `height: 100vh` makes the page fill the full viewport. Inside the admin sidebar this pushes the input bar below the fold, requiring scrolling to type a new message.

## What Changes

- Add a "Route-Agent" nav item to the admin sidebar Daten group, positioned alongside Support-Agent and Test-Agent
- Replace the thin `#agent-bar` with a scrollable message area (`#route-agent-messages`) following the same pattern as the test-agent timeline
- Change the page layout from `height: 100vh` to a flex column that fills available space (not viewport), keeping the input bar always visible
- Update the stream asset (`route-agent-stream.tsx`) to render message bubbles and tool cards instead of plain text in a bar

## Capabilities

### New Capabilities

- `admin-sidebar-route-agent`: Route-Agent entry in the admin sidebar navigation

### Modified Capabilities

- `route-agent-ui`: Route-agent chat UI changed from bar-style to scrollable message history
- `route-agent-stream`: Client-side stream handler changed from bar text to bubble rendering

## Impact

- `app/ui/admin-layout.tsx` — add Route-Agent nav item
- `app/ui/route-agent-page.tsx` — layout change (replace bar with messages area, adjust sizing)
- `app/assets/route-agent-stream.tsx` — render message bubbles, tool cards, auto-scroll
- `app/actions/route-agent/controller.tsx` — wrap in `AdminLayout` inside admin sidebar (optional, if frame-based)
