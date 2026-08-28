## 1. Browser streams

- [x] 1.1 Delete `app/assets/streams/public/route-agent-stream.tsx` and `app/assets/streams/public/test-agent-stream.tsx` and verify no remaining importers exist (`rg "route-agent-stream|test-agent-stream" app/`)
- [x] 1.2 Remove the `TestAgentStream` / `RouteAgentStream` imports and their test blocks from `app/assets/streams/streams.test.browser.tsx` and verify the file still imports/renders the surviving streams (support, customer, workflow, agent-events)

## 2. UI pages

- [x] 2.1 Delete `app/ui/route-agent-page.tsx` and `app/ui/test-agent-page.tsx` and verify no remaining importers exist (`rg "route-agent-page|test-agent-page" app/`)

## 3. Controllers and controller tests

- [x] 3.1 Delete `app/actions/route-agent/controller.tsx` and verify no remaining importers exist (`rg "actions/route-agent" app/`)
- [x] 3.2 Delete `app/actions/test-agent/controller.tsx` and `app/actions/test-agent/controller.test.ts` and verify no remaining importers exist (`rg "actions/test-agent" app/`)

## 4. Routes, router, and navigation

- [x] 4.1 Remove the `testAgent` and `routeAgent` route trees from `app/routes.ts` and verify the route contract typechecks
- [x] 4.2 Remove the `testAgent` / `routeAgent` imports and `router.map(...)` calls from `app/router.ts` and verify the router still maps all remaining routes
- [x] 4.3 Remove the Route-Agent link from `app/ui/nav.ts` and verify the nav test (`app/ui/nav.test.ts`) still passes
- [x] 4.4 Remove the `testagent` nav item, its `AdminNavItem` union entry, and the `testAgentSvg()` helper from `app/ui/admin-layout.tsx` and verify the admin sidebar renders without it

## 5. Middleware and shared utilities

- [x] 5.1 Remove `'/testagent'` and `'/route-agent'` from `AGENT_PATHS` in `app/middleware/skip-csrf.ts` and verify the remaining agent paths (support, workflow, agent-events) are unchanged
- [x] 5.2 Remove `'route-agent-frame-container'` from `CONTAINER_IDS` in `app/utils/frame-utils.ts` and verify `safeReload`/`safeNavigate` still resolve the support-agent container

## 6. Agent tools and agent definitions

- [x] 6.1 Delete `app/actions/mastra/tools/test-tools.ts` and `app/actions/mastra/tools/test-tools.test.ts` and verify no remaining importers exist (`rg "test-tools" app/`)
- [x] 6.2 Keep `app/actions/mastra/tools/route-navigate.ts` (imported by `supportAgent`) and delete `app/actions/mastra/tools/route-find-list.ts` — no surviving agent imports `findList` (`rg "route-navigate|route-find-list|findList" app/`)
- [x] 6.3 Delete `app/actions/mastra/agents/test-agent.ts` and `app/actions/mastra/agents/route-agent.ts` and verify no remaining importers exist (`rg "agents/test-agent|agents/route-agent" app/`)

## 7. Mastra registry

- [x] 7.1 Remove the `testAgent` and `routeAgent` imports and registry entries from `app/actions/mastra/index.ts` and verify `mastra.getAgent('testAgent'|'routeAgent')` no longer resolves (agents registry now only `supportAgent`, `customerAgent`, `workflowAgent`)

## 8. Verification

- [x] 8.1 Run `rg -n "routeAgent|testAgent|route-agent|testagent" app/` and confirm the only remaining matches are in OpenSpec artifacts (or intentional survivors such as the support-agent `_testAgent` seam), then run `npm run typecheck` clean
- [x] 8.2 Run `npm run lint` and `npm test` and confirm the full suite passes with the retired agents removed
- [x] 8.3 Record the deletion in `docs/DELETION_LOG.md` following the existing refactor-session format