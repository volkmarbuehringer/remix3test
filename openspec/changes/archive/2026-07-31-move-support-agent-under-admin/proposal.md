## Why

The support-agent chat lives at `/mastra/chat`. Its admin sidebar entry navigates the `admin-content` frame to that URL, which hits the controller's frame branch and renders only a read-only message list — no chat input box, no stream wiring. Direct GET renders the full page but outside the admin shell (public `MainNav`), and the inner panel frame is named `admin-content`, which collides with the admin page frame. `workflow-agent` already proved the fix: nest under `/admin`, render via `renderAdminPage()`, rename the panel frame, and register it as content-only.

## What Changes

- Move the mastra chat route tree (`index`, `panel`, `action`, `toolDecision`, `answer`) from `routes.mastra.chat` to `routes.admin.supportAgent` → URLs become `/admin/support-agent(/*)`
- The chat controller's `index` renders via `renderAdminPage()` so the admin sidebar is present for both frame and direct access, and the chat input box is always rendered
- Remove the manual frame/direct two-branch render in `index`; drop the `?threadId=` read-only conversation view (the chatlog detail fragment already covers read-only conversation rendering)
- Rename the inner panel frame `admin-content` → `support-agent-panel` (name + `data-active-frame`) and register it in `contentOnlyTargets`
- SSE `navigate` events (from `routeNavigate`) target `support-agent-panel` via a `getTarget` mapping passed to `pipeStream`
- Hardcoded client URLs, CSRF exemptions, and route labels are updated to the `/admin/support-agent(/*)` paths
- The now-empty `routes.mastra` route tree is removed entirely

## Capabilities

### New Capabilities

None.

### Modified Capabilities

`admin-agent-routes` — the support-agent chat joins workflow-agent and agent-events as an agent route served under `/admin` with the admin sidebar shell.

## Impact

- `app/routes.ts` — nest `supportAgent` under `admin`; remove the `mastra` tree
- `app/router.ts` — `router.map(routes.admin.supportAgent, mastraChat)`; drop `routes.mastra.chat`
- `app/actions/mastra/controller.tsx` — `createController` target, `renderAdminPage` in `index`, delete frame branch, `getTarget` for `pipeStream`
- `app/ui/support-agent-page.tsx` — panel frame name + `data-active-frame`
- `app/ui/admin-layout.tsx` — nav item route → `routes.admin.supportAgent.index`; add `support-agent-panel` to `contentOnlyTargets`
- `app/assets/streams/support-agent-stream.browser.tsx` — hardcoded URLs, frame name defaults
- `app/middleware/skip-csrf.ts` — path exemptions
- `app/route-labels.ts` — href key
- `app/ui/admin-page.tsx` / `app/ui/scaffold-home-page.tsx` / `app/ui/admin-chatlog-page.tsx` — href references
- `app/ui/admin-mastra-chat-page.tsx` — deleted (dead after dropping the threadId view)
- `app/actions/mastra/controller.test.ts` — URL constants and test names

## Non-goals

- No change to agent behavior, tool schemas, or the SSE event protocol
- No change to the Mastra integration backend (`app/actions/mastra/` agents, tools, workflows, storage)
- No default content for the panel frame (stays a placeholder)
- No change to `route-agent`, `testagent`, `customer chat`, or other top-level routes
