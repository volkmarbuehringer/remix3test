## 1. Relocate shared workflow-stream helper

- [x] 1.1 Move `app/actions/workflow-agent/workflow-sse.ts` and `workflow-sse.test.ts` into `app/actions/agent-events/` and verify the moved test passes (`npm test -- app/actions/agent-events/workflow-sse.test.ts`)
- [x] 1.2 Update `app/actions/agent-events/controller.tsx` to import `pipeWorkflowStream` from `./workflow-sse.ts` and verify `npm run typecheck` passes

## 2. Port lookup-user intent into agent-events

- [x] 2.1 Add `LOOKUP_USER = 'lookup-user'` to `app/actions/agent-events/intents.ts` and verify the export is present
- [x] 2.2 Add `'user-action:lookup': INTENTS.LOOKUP_USER` to `AGENT_ACTION_TO_INTENT` in `app/actions/mastra/intent-classifier.ts` and verify a `classifyWithAgent` unit test resolves `lookup` to `lookup-user`
- [x] 2.3 Handle `lookup-user` in `app/actions/agent-events/handlers/dispatch.ts` to navigate to `/admin/users?filter=<target>` with no workflow request and verify an agent-events controller test asserts the navigate event and no `start` event

## 3. Port period/status filters into agent-events

- [x] 3.1 Extend `classifyWithAgent` in `app/actions/mastra/intent-classifier.ts` to return `period?`/`status?` parsed from the agent JSON and verify a unit test extracts them
- [x] 3.2 Pass `period`/`status` through the `intent.classified` event in `app/actions/agent-events/handlers/classify.ts` and verify the event payload carries them
- [x] 3.3 In `app/actions/agent-events/handlers/dispatch.ts`, whitelist-validate `period` (`today|this-week|this-month|next-week|next-month`) and `status` (`pending|expired`) and append them to the `/verwaltung/appointments` href, and verify a controller test asserts the query params on the navigate event (and that invalid values are dropped)

## 4. Delete the workflow-agent surface

- [x] 4.1 Remove the `admin.workflowAgent` route tree and `workflowAgentPanel` frame from `app/routes.ts` and verify `npm run typecheck` passes
- [x] 4.2 Remove `router.map(routes.admin.workflowAgent, admin.workflowAgent)` from `app/router.ts` and the `workflowAgent` re-export from `app/actions/admin/controller.tsx` and verify the router builds
- [x] 4.3 Remove the `workflow` nav item, icon case, `AdminNavItem` member, `frames.workflowAgentPanel` from `contentOnlyTargets`, and `routes.admin.workflowAgent.index.href()` from `fullHeightTargets` in `app/ui/admin-layout.tsx` and verify the admin sidebar renders without the Workflow-Agent entry
- [x] 4.4 Delete `app/ui/workflow-agent-page.tsx`, `app/assets/streams/public/workflow-agent-stream.tsx`, `app/actions/workflow-agent/controller.tsx`, and `app/actions/workflow-agent/controller.test.ts` and verify no remaining import references them (`grep -rn "workflow-agent" app` returns only the `/admin/agent-events` surface)
- [x] 4.5 Remove the dead `WorkflowAgentStream` import from `app/assets/streams/streams.test.browser.tsx` and verify the browser stream suite still passes

## 5. Final verification

- [x] 5.1 Extend `app/actions/agent-events/controller.test.ts` so the change spec scenarios (retired `/admin/workflow-agent` 404, `lookup-user`, `period`/`status`, delete-appointments confirm) are covered and the agent-events suite passes (`npm test -- app/actions/agent-events`)
- [x] 5.2 Run `npm run typecheck` and the full `npm test` suite and verify everything is green