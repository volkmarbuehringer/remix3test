## 1. Database Schema

- [x] 1.1 Add `workflowRuns` table schema to `app/data/schema.ts`
- [x] 1.2 Add `workflow_runs` table creation SQL to `app/data/setup.ts`

## 2. Workflow Engine (port from my_app)

- [x] 2.1 Create `app/workflows/types.ts` — port workflow type definitions
- [x] 2.2 Create `app/workflows/registry.ts` — port workflow registration/lookup
- [x] 2.3 Create `app/workflows/engine.ts` — port workflow execution engine
- [x] 2.4 Create `app/workflows/tools.ts` — port tool definitions (weather, wiki, query, notify)
- [x] 2.5 Create `app/workflows/definitions/index.ts` — port workflow definition loader
- [x] 2.6 Create `app/workflows/definitions/restock-analysis.ts` — port Restock Analysis workflow
- [x] 2.7 Create `app/workflows/definitions/trending-report.ts` — port Trending Report workflow
- [x] 2.8 Create `app/workflows/definitions/create-purchase-order.ts` — port Create Purchase Order workflow

## 3. Route and Controller

- [x] 3.1 Add workflow sub-route under `aiRoutes` in `app/routes.ts`
- [x] 3.2 Wire workflow controller in `app/router.ts` and import definitions
- [x] 3.3 Create `app/actions/workflow/controller.tsx` — workflow GET/POST controller (uses renderAiPage)

## 4. UI Pages (adapted to newapp theme)

- [x] 4.1 Create `app/actions/workflow/page.tsx` — workflow index UI with theme tokens and Button component
- [x] 4.2 Create `app/actions/workflow/run-page.tsx` — workflow run detail UI with theme tokens

## 5. Client Entry and Navigation

- [x] 5.1 Create `app/ui/workflow-parameters.tsx` — client entry for dynamic form inputs
- [x] 5.2 Update `app/ui/nav.ts` — add Workflows nav link under AI section
- [x] 5.3 Update `app/ui/ai-layout.tsx` — add workflow nav item to AI sidebar

## 6. Verification

- [x] 6.1 Run `pnpm typecheck` to confirm no type errors
- [x] 6.2 Run `pnpm test` to confirm all tests pass
