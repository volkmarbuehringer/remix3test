## Why

`workflow-agent` (`/workflow-agent`) and `agent-events` (`/workflowagent2`) are admin-only agent routes, but both render through the public `Layout` shell (`MainNav`) instead of the admin sidebar shell. They are linked from the admin sidebar yet present as standalone public pages — an inconsistency. The `client`/`nutzer`/`test-agent` routes already prove the admin-nested pattern; the agent routes should follow suit and live under `/admin`.

## What Changes

- Nest `workflowAgent` and `agentEvents` route trees under the `admin` route tree → URLs become `/admin/workflow-agent` and `/admin/workflowagent2`
- Both controllers render via `renderAdminPage()` so the admin sidebar is present for both frame and direct access
- Sidebar nav items switch from document navigation (`iframeNav: false`) to frame navigation (`target: admin-content`)
- Inner panel frames in both agent pages are renamed from `admin-content` to unique names (`workflow-agent-panel`, `agent-events-panel`) to keep sidebar frame navigation resolving to the page frame instead of the nested panel frame
- SSE navigate events emitted by both controllers target the renamed panel frame
- Hardcoded client URLs, CSRF exemptions, and route labels are updated to the `/admin/...` paths

## Capabilities

### New Capabilities

`admin-agent-routes` — agent routes served under `/admin` with the admin sidebar shell.

### Modified Capabilities

None — no agent behavior, SSE protocol, or event-bus changes. This is a route residency + layout change only.

## Impact

- `app/routes.ts` — nest both route trees under `admin`
- `app/router.ts` — map via `routes.admin.workflowAgent` / `routes.admin.agentEvents`
- `app/actions/workflow-agent/controller.tsx` — `createController` target, `renderAdminPage` in `index`, navigate target, `getTarget()` prefix map
- `app/actions/agent-events/controller.tsx` — `createController` target, `renderAdminPage` in `index`, navigate target
- `app/ui/admin-layout.tsx` — nav item routes, drop `iframeNav: false`
- `app/ui/workflow-agent-page.tsx` / `app/ui/agent-events-page.tsx` — panel frame name + `data-active-frame`
- `app/assets/streams/workflow-agent-stream.browser.tsx` / `agent-events-stream.browser.tsx` — hardcoded URLs, panel frame name defaults
- `app/middleware/skip-csrf.ts` — path exemptions
- `app/route-labels.ts` — href keys
- `app/actions/workflow-agent/controller.test.ts` / `app/actions/agent-events/controller.test.ts` — URL constants

## Non-goals

- No change to agent behavior, tool schemas, or the SSE event protocol
- No change to the event-bus pipeline or Mastra workflow definitions
- No change to `route-agent`, `testagent`, or other top-level agent routes
