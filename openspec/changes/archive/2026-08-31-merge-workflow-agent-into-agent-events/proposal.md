## Why

`/admin/workflow-agent` and `/admin/agent-events` are two front-ends for the same backend: both take a natural-language admin command, classify it into an intent, resolve target entities, run the same two Mastra workflows (`userManagementWorkflow`, `deleteUserAppointmentsWorkflow`), and drive the same navigate+confirm gate. `agent-events` is the newer, hardened rewrite of that flow — durable DB-backed active-run index, reconnect snapshot verification, TTL-bounded run→workflow map, fail-fast resume, and test seams (`__setRunFactory`/`__setRunStatusResolver`). The `workflow-agent` controller is the older ad-hoc version: an unbounded in-memory run map, no reconnect, a resume path that can guess the wrong workflow, and a confirm flow that was already diagnosed as broken (`diagnose-workflow-agent-answer`). Keeping both means two pages, two controllers, two nav entries, and two stream components that implement the same semantics. The `workflowAgent` agent itself survives either way — `agent-events` already reuses it as the intent classifier (`classify.ts`).

## What Changes

- **BREAKING** Remove the `/admin/workflow-agent` page, controller, route, admin nav item, panel frame (`workflow-agent-panel`), UI page (`app/ui/workflow-agent-page.tsx`), and stream component (`app/assets/streams/public/workflow-agent-stream.tsx`). The URL returns 404 and the nav entry disappears.
- Keep `/admin/agent-events` as the single command-pipeline surface for admin workflow commands. Its page, pipeline, and durable run handling are unchanged in architecture.
- Keep the `workflowAgent` agent — it remains the LLM intent classifier used by the `agent-events` classify handler.
- Keep `app/actions/workflow-agent/workflow-sse.ts` (shared with `agent-events`) but relocate it into the `agent-events` module so the `workflow-agent` directory can be deleted wholesale.
- **Port two admin-facing behaviors that `agent-events` does not yet cover** so the merge is behavior-preserving:
  - Appointment-check `period`/`status` query params (`?period=this-week&status=pending`) on the `/verwaltung/appointments` navigation.
  - A bare user `lookup` intent (navigate to `/admin/users?filter=...` with no workflow run).
- Delete the now-redundant `workflow-agent` specs or fold their still-true requirements into the `agent-events` specs (see Capabilities).

## Capabilities

### New Capabilities

_(none — this change consolidates existing capabilities, it does not introduce a new one)_

### Modified Capabilities

- `admin-agent-routes`: remove the workflow-agent route, panel endpoint, nav-item, and panel-frame requirements; the command-pipeline page is served only at `/admin/agent-events`.
- `agent-events-intent-classification`: add the `lookup-user` intent and the `period`/`status` params to the appointment-check classification so the two ported behaviors are spec-covered.
- `agent-events-confirm-execute`: fold in any delete-appointments / confirm-gate requirements currently living in the workflow-agent specs.
- `workflow-agent-appointment-queries`: requirements move to `agent-events-*` (period/status preserved) or are removed; the capability is retired.
- `workflow-agent-appointment-delete-resource`: requirements are already covered by `agent-events-confirm-execute`; the capability is retired.
- `workflow-agent-appointment-user-resolution`: requirements are already covered by the `agent-events` resolve handler; the capability is retired.

## Impact

- **Routes** — `app/routes.ts`: remove the `admin.workflowAgent` route tree and the `workflowAgentPanel` frame.
- **Router** — `app/router.ts`: remove `router.map(routes.admin.workflowAgent, admin.workflowAgent)` and the re-export in `app/actions/admin/controller.tsx`.
- **Controllers** — delete `app/actions/workflow-agent/controller.tsx` (+ its test); move `workflow-sse.ts`/`workflow-sse.test.ts` into `app/actions/agent-events/`; add `period`/`status` and `lookup` handling to the `agent-events` handlers (`intents.ts`, `intent-classifier.ts`, `dispatch.ts`).
- **UI** — delete `app/ui/workflow-agent-page.tsx` and `app/assets/streams/public/workflow-agent-stream.tsx`; remove the `workflow` nav item + icon from `app/ui/admin-layout.tsx` and the frame targets from `contentOnlyTargets`/`fullHeightTargets`.
- **Specs** — retire `workflow-agent-appointment-*` capabilities, modify `admin-agent-routes` and `agent-events-*` specs (see Capabilities).
- **Tests** — update `app/actions/agent-events/controller.test.ts`; delete `app/actions/workflow-agent/controller.test.ts`; re-run e2e coverage for the `/admin/agent-events` surface.
- **No change** to `support-agent`, `/chat`, the Mastra workflows, or the `workflowAgent` agent definition.