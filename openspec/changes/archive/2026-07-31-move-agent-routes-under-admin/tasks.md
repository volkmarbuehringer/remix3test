# Tasks

## 1. Route tree nesting

- [x] 1.1 In `app/routes.ts`, move `workflowAgent` and `agentEvents` route objects inside `routes.admin` (URLs become `/admin/workflow-agent`, `/admin/workflowagent2`)
- [x] 1.2 In `app/router.ts`, change `router.map(routes.workflowAgent, workflowAgent)` → `router.map(routes.admin.workflowAgent, workflowAgent)` and `router.map(routes.agentEvents, agentEvents)` → `router.map(routes.admin.agentEvents, agentEvents)`

## 2. Controller rendering

- [x] 2.1 `app/actions/workflow-agent/controller.tsx`: change `createController(routes.workflowAgent, ...)` → `routes.admin.workflowAgent`; `index` renders `renderAdminPage(context.render, 'workflow', <WorkflowAgentPage />)`; drop the now-unused `Layout` import
- [x] 2.2 `app/actions/agent-events/controller.tsx`: change `createController(routes.agentEvents, ...)` → `routes.admin.agentEvents`; `index` renders `renderAdminPage(context.render, 'agentevents', <AgentEventsPage />)`; drop the now-unused `Layout` import

## 3. Panel frame rename

- [x] 3.1 `app/ui/workflow-agent-page.tsx`: `<Frame name="admin-content">` → `name="workflow-agent-panel"`; `data-active-frame` → `workflow-agent-panel`
- [x] 3.2 `app/ui/agent-events-page.tsx`: `<Frame name="admin-content">` → `name="agent-events-panel"`; `data-active-frame` → `agent-events-panel`
- [x] 3.3 `app/actions/workflow-agent/controller.tsx`: SSE navigate event targets → `workflow-agent-panel` (user-not-found and locked/unlocked navigate emissions); update `getTarget()` prefix row `/workflow-agent` → `/admin/workflow-agent`
- [x] 3.4 `app/actions/agent-events/controller.tsx`: SSE navigate event targets → `agent-events-panel` (`entities.notfound` emission and generic `navigate` passthrough)

## 4. Client stream URLs and frame defaults

- [x] 4.1 `app/assets/streams/workflow-agent-stream.browser.tsx`: hardcoded `'/workflow-agent'` → `'/admin/workflow-agent'` (form submit + resume); `data-active-frame` / navigate target defaults → `workflow-agent-panel`
- [x] 4.2 `app/assets/streams/agent-events-stream.browser.tsx`: hardcoded `'/workflowagent2'` → `'/admin/workflowagent2'` (form submit + resume); `data-active-frame` / navigate target defaults → `agent-events-panel`

## 5. Sidebar and route references

- [x] 5.1 `app/ui/admin-layout.tsx`: nav item routes → `routes.admin.workflowAgent.index` / `routes.admin.agentEvents.index`; remove `iframeNav: false` from both items (frame nav)
- [x] 5.2 `app/middleware/skip-csrf.ts`: exemptions → `/admin/workflow-agent(/*)` and `/admin/workflowagent2(/*)`
- [x] 5.3 `app/route-labels.ts`: href keys → `routes.admin.workflowAgent.index.href()` / `routes.admin.agentEvents.index.href()`

## 6. Tests

- [x] 6.1 `app/actions/workflow-agent/controller.test.ts`: update URL constants to `/admin/workflow-agent(/*)`
- [x] 6.2 `app/actions/agent-events/controller.test.ts`: update URL constants to `/admin/workflowagent2(/*)`

## 7. Verification

- [x] 7.1 Run `npm test` and `npm run typecheck`
- [x] 7.2 Manual: sidebar visible and navigable on both agent pages; SSE navigate drives the panel; old `/workflow-agent` and `/workflowagent2` paths no longer render the agent pages
