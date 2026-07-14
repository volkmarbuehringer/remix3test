## Why

The route-agent POC currently only navigates a single frame target (`lists-content`), hardcoded in `filterAndForward()` at `app/actions/route-agent/controller.tsx:85`. This means the agent cannot navigate admin pages (e.g., `/admin/chatlog`, `/admin/messages`, `/admin/users`) or any other frame-based area — it's locked to lists.

As the route-agent evolves from a proof-of-concept toward a useful admin tool, it needs to navigate any frame-based route in the application. The agent should not need to know about frame targets — the controller should map paths to the correct target automatically.

## What Changes

- `filterAndForward` in the route-agent controller maps route path prefixes to frame target names (e.g., `/admin/*` → `admin-content`, `/lists/*` → `lists-content`)
- The route-agent page gains a second `<Frame name="admin-content">` alongside the existing `lists-content` frame
- The client-side stream handler (`route-agent-stream.tsx`) controls frame visibility — only the active frame is shown
- The `navigate` event from `filterAndForward` already carries a `target` property; the client uses it to find the correct frame and show it
- No changes needed in the admin layout, chatlog controller, or any other route — they render as fragments automatically via `X-Remix-Target` header

## Capabilities

### New Capabilities

- `route-agent-multi-frame`: The route-agent can navigate any frame-based route (admin, lists, or future frame targets) by mapping path prefixes to the correct frame target name
- `route-agent-frame-visibility`: The client-side stream handler shows/hides frames based on which one the agent navigates to, keeping the UI clean

### Modified Capabilities

- `route-agent-controller`: `filterAndForward` now maps routes to targets instead of hardcoding `lists-content`
- `route-agent-page`: Has both `lists-content` and `admin-content` frames; visibility controlled by client
- `route-agent-stream`: `handleNavigate` shows the target frame and hides others; `handleFrameFormSubmit` reloads the correct active frame

## Impact

- **Controller** (`app/actions/route-agent/controller.tsx`): Add a route-to-target mapping function; call it in `filterAndForward` instead of the hardcoded `lists-content` string
- **Page** (`app/ui/route-agent-page.tsx`): Add a second `<Frame name="admin-content">` alongside the existing `lists-content` frame; wire visibility via `data-active-frame` attribute or CSS class
- **Client** (`app/assets/route-agent-stream.tsx`): In `handleNavigate`, when `target` is provided, show that frame and hide the other(s); in `handleFrameFormSubmit`, reload the currently active frame instead of hardcoded `lists-content`
