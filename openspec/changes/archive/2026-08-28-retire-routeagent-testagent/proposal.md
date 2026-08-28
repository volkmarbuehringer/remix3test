## Why

Two of the five registered Mastra agents are outdated POCs with no product value. `routeAgent` was a routing experiment whose toolset (`routeNavigate`, `askUserTool`) was absorbed into `supportAgent` days after it shipped; `testAgent` is a dev-only filesystem-explorer prototype. Both add LLM surface area (including approval-gated workspace file write/edit/delete tools), dead code, and a maintenance burden for features nobody uses.

## What Changes

- **BREAKING**: Remove `routeAgent` and `testAgent` from the Mastra agents registry (`app/actions/mastra/index.ts`). `mastra.getAgent('routeAgent' | 'testAgent')` will throw.
- **BREAKING**: Delete the `/route-agent` route — `routes.ts`, `router.ts` map, and the top-nav link in `app/ui/nav.ts`. The URL will 404.
- **BREAKING**: Delete the `/testagent` route — `routes.ts`, `router.ts` map, and the admin sidebar "Test-Agent" entry + icon in `app/ui/admin-layout.tsx`. The URL will 404.
- Delete the controllers, pages, and browser streams for both agents:
  - `app/actions/route-agent/controller.tsx`
  - `app/actions/test-agent/controller.tsx` + `controller.test.ts`
  - `app/ui/route-agent-page.tsx`, `app/ui/test-agent-page.tsx`
  - `app/assets/streams/public/route-agent-stream.tsx`, `app/assets/streams/public/test-agent-stream.tsx`
- Delete the test-agent tooling: `app/actions/mastra/tools/test-tools.ts` (+ `test-tools.test.ts`) and `app/actions/mastra/tools/route-find-list.ts` — no surviving agent imports `findList`.
- **KEEP** `route-navigate.ts` — `supportAgent` still imports it. The `routeNavigate` tool and `askUserTool` remain available on `supportAgent`.
- Update specs: remove the requirements describing the retired agents across the affected capabilities (see Modified Capabilities).

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `dedicated-route-agent`: Remove all requirements — the dedicated `routeAgent` agent, its controller, and its upload/form navigation protocols are retired.
- `auth-gated-testagent-route`: Remove all requirements — the `/testagent` route, its auth gating, and its admin sidebar entry are retired.
- `testagent-workspace-tools`: Remove all requirements — the `mastra_workspace_*` file tools are retired with the test agent.
- `test-agent-tool-approval`: Remove all requirements — the legacy `read_test_file` approval gate is retired.
- `file-directory-enumeration`: Remove all requirements — the `listTestFiles` tool is retired.
- `admin-uploads-route`: Remove the "Route-agent navigates to /admin/uploads" requirement — the route-agent upload protocol is retired (the `/admin/uploads` route itself stays).
- `structured-question-ui`: Remove the requirement naming `app/assets/route-agent-stream.tsx` as the client entry — the shared question UI lives on via `support-agent-stream.tsx`.
- `frame-aware-reload`: Remove the requirement to detect `#route-agent-frame-container`.

## Impact

- **Mastra registry**: agents count drops 5 → 3 (`supportAgent`, `customerAgent`, `workflowAgent`).
- **Routes removed**: `/route-agent`, `/testagent` (and all sub-routes: `/stream/:runId`, `/approve`, `/decline`, `/answer`, `/panel`, `/tool-decision`).
- **Files deleted**: ~8 source files + 2 test files (see What Changes).
- **Dependencies**: none removed — `@mastra/core/workspace` usage disappears from the app (workspace tools were only used by `testAgent`).
- **Tests**: `app/actions/test-agent/controller.test.ts` is deleted. No E2E tests reference either route. The support-agent and chat controller tests are unaffected (`routeNavigate` stays; `findList` is removed).
- **Security**: removes the approval-gated filesystem write/edit/delete surface exposed by `testAgent` in the admin panel.