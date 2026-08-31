## Context

See `proposal.md` — Why for motivation. Current state that shapes the approach:

- `app/actions/workflow-agent/` holds the retiring controller (`controller.tsx`, 540 lines) plus the only artifact the `agent-events` pipeline still needs: `workflow-sse.ts` (+ `workflow-sse.test.ts`), imported by `app/actions/agent-events/controller.tsx:14`.
- `app/actions/agent-events/` is the keeper: `event-bus.ts`, `intents.ts`, `register.ts`, `handlers/{validate,classify,resolve,dispatch}.ts`, `active-run-store.ts`, and a controller that already runs both `userManagementWorkflow` and `deleteUserAppointmentsWorkflow` with durable confirm gates and reconnect.
- `app/actions/mastra/intent-classifier.ts` maps the `workflowAgent` agent's JSON (`type`+`action`) to agent-events intents via `AGENT_ACTION_TO_INTENT`. It already maps `appointment:check` → `show-appointments` and `user-action:cancel|lock|unlock` → intents, but **not** `user-action:lookup`, and it discards the `period`/`status` fields the agent emits.
- The `workflowAgent` agent definition (`app/actions/mastra/agents/workflow-agent.ts`) survives unchanged — it is the classifier backend. Its instructions already emit `period`/`status` and the `lookup` action, so no agent prompt change is needed.

## Goals / Non-Goals

**Goals:**
- Delete the `/admin/workflow-agent` page, controller, route, nav entry, panel frame, UI page, and stream component so a single command-pipeline surface (`/admin/agent-events`) remains.
- Preserve the two admin-facing behaviors `agent-events` lacks: appointment-check `period`/`status` filters and the bare user `lookup` navigation.
- Keep the `workflowAgent` agent and both workflows running unchanged.

**Non-Goals:**
- Not porting `_recordWorkflowResult` (workflow-result recording into the agent memory thread) — `agent-events` uses its durable `active-run-store` instead.
- Not porting `normalizeUserAction`/`ACTION_ALIASES` — redundant with the agent's German→English verb instructions, which `agent-events` already relies on.
- Not porting the `getTarget` path→frame mapping — `agent-events` dispatches navigate targets per intent.
- Not touching `support-agent`, `/chat`, or the Mastra workflow definitions.

## Decisions

### 1. Relocate `workflow-sse.ts` into `app/actions/agent-events/`

Move `workflow-sse.ts` + `workflow-sse.test.ts` from `app/actions/workflow-agent/` to `app/actions/agent-events/`, and update the import in `app/actions/agent-events/controller.tsx` (and its test). This is the only shared artifact, so after the move the entire `workflow-agent/` directory can be deleted.

*Alternatives considered:* keep `workflow-sse.ts` in place and delete only the controller — rejected, it leaves an orphan directory and the proposal calls for deleting the directory wholesale.

### 2. Port `period`/`status` through classify → dispatch

Thread the two fields the agent already emits through the pipeline without changing the agent:

- `intent-classifier.ts` — `classifyWithAgent` additionally returns `period?`/`status?` parsed from the agent JSON.
- `handlers/classify.ts` — pass `period`/`status` into the `intent.classified` event params.
- `handlers/dispatch.ts` — the `show-appointments` handler appends validated `period`/`status` to the `/verwaltung/appointments` href alongside `filter`.

The values SHALL be validated against the known enums (`today|this-week|this-month|next-week|next-month`; `pending|expired`) before being appended, so a malformed LLM field cannot inject arbitrary query params.

*Alternatives considered:* have the agent return a ready-made URL — rejected, URL construction stays in the handler (consistent with existing `filter` handling), and the agent stays schema-driven.

### 3. Add a `lookup-user` intent

- `intents.ts` — add `LOOKUP_USER = 'lookup-user'`.
- `intent-classifier.ts` — add `'user-action:lookup': INTENTS.LOOKUP_USER` to `AGENT_ACTION_TO_INTENT` (today it falls through to `unclear`).
- `handlers/dispatch.ts` — `lookup-user` navigates to `/admin/users?filter=<targetQuery>` and emits no workflow request and no confirm gate.

The existing classifier rule (every intent except `show-appointments` requires a non-empty target) already makes a target-less lookup resolve to `intent.unclear`, matching the retiring controller's "Which user?" error.

### 4. Delete route, nav, and UI surface

- `routes.ts` — remove the `admin.workflowAgent` route tree and the `workflowAgentPanel` frame.
- `router.ts` — remove `router.map(routes.admin.workflowAgent, admin.workflowAgent)`.
- `app/actions/admin/controller.tsx` — remove the `workflowAgent` re-export.
- `app/ui/admin-layout.tsx` — remove the `workflow` nav item, its icon case, the `AdminNavItem` member, `frames.workflowAgentPanel` from `contentOnlyTargets`, and `routes.admin.workflowAgent.index.href()` from `fullHeightTargets`.
- Delete `app/ui/workflow-agent-page.tsx`, `app/assets/streams/public/workflow-agent-stream.tsx`, `app/actions/workflow-agent/controller.tsx`, and `app/actions/workflow-agent/controller.test.ts`.

## Risks / Trade-offs

- [LLM emits a malformed `period`/`status` value] → Mitigation: whitelist-validate before appending to the href; invalid values are dropped (behavior degrades to the unfiltered navigation, never an injected query).
- [Dropping `_recordWorkflowResult` loses per-admin thread memory of past workflow outcomes] → Mitigation: acceptable — `agent-events` never read that thread, and its durable run index is the source of truth for resumption. Documented as a non-goal.
- [Dead `WorkflowAgentStream` import in `app/assets/streams/streams.test.browser.tsx`] → Mitigation: remove the import line; no test renders it.
- [Regression in the merged surface goes unnoticed] → Mitigation: extend `app/actions/agent-events/controller.test.ts` with `lookup-user` and `period`/`status` scenarios before deleting the workflow-agent tests; the change spec scenarios map 1:1 to these tests.

## Migration Plan

1. Relocate `workflow-sse.ts` (+ test) into `app/actions/agent-events/`; update imports; run the agent-events suite.
2. Port `period`/`status` and `lookup-user` through `intents.ts` / `intent-classifier.ts` / `classify.ts` / `dispatch.ts`; add tests.
3. Remove the route tree, router map, admin re-export, nav item, and UI/stream/controller files.
4. Remove the dead stream import from `streams.test.browser.tsx`.
5. Run `npm run typecheck` and the full test suite.

Rollback: pure code removal — `git revert` of the merge restores the `/admin/workflow-agent` route, page, and controller. No data migration, no feature flag.

## Open Questions

None that affect specs, approach, or task breakdown.