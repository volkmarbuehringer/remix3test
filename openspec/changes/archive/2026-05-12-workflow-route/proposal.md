## Why

The `my_app` project has a workflow engine — a configurable multi-step workflow runner with async execution, tool integration, LLM-powered steps, and workflow chaining. This engine is a natural fit alongside newapp's Chat and Agent AI features under `/ai/`. Porting it to newapp adds a powerful "Agentic workflow" capability: users can run predefined workflows (restock analysis, trending reports, purchase orders) that combine LLM reasoning with tool execution and database queries.

## What Changes

- Port the workflow engine from `my_app`: types, registry, execution engine, tools, and workflow definitions
- Add a `/ai/workflow` route as a sub-route of the existing AI section (under `aiRoutes`)
- Add `workflow_runs` table to the database schema and setup
- Create workflow controller with GET (list/view runs) and POST (trigger run) actions
- Create workflow UI pages: index page (workflow list + run form + recent runs) and run detail page
- Port `workflow-parameters.tsx` client entry for dynamic form inputs
- Adapt all UI styling to use newapp's `app/theme.tsx` token system and `Button` from `remix/ui/button`
- Update nav with "Workflows" link under the AI section
- All workflow routes require authentication (consistent with other AI routes)

**No breaking changes** — this is additive only.

## Capabilities

### New Capabilities

- `workflow-execution`: Multi-step workflow engine with async execution, tool integration, LLM-powered steps, workflow chaining, and persistent run tracking

### Modified Capabilities

_(None — no existing specs are changing)_

## Impact

- **New files** (ported from my_app):
  - `app/workflows/types.ts` — Workflow type definitions
  - `app/workflows/registry.ts` — Workflow registration and lookup
  - `app/workflows/engine.ts` — Workflow execution engine
  - `app/workflows/tools.ts` — Tool definitions (weather, wiki, query, notify)
  - `app/workflows/definitions/index.ts` — Workflow definition loader
  - `app/workflows/definitions/restock-analysis.ts` — Restock Analysis workflow
  - `app/workflows/definitions/trending-report.ts` — Trending Report workflow
  - `app/workflows/definitions/create-purchase-order.ts` — Create Purchase Order workflow
  - `app/actions/workflow/controller.tsx` — Workflow controller (GET/POST)
  - `app/actions/workflow/page.tsx` — Workflow index UI
  - `app/actions/workflow/run-page.tsx` — Workflow run detail UI
  - `app/ui/workflow-parameters.tsx` — Client entry for dynamic parameters
- **Modified files**:
  - `app/routes.ts` — add workflow sub-route under aiRoutes
  - `app/router.ts` — map workflow controller
  - `app/data/schema.ts` — add workflowRuns table schema
  - `app/data/setup.ts` — add workflow_runs table creation SQL
  - `app/ui/nav.ts` — add Workflows nav link under AI section
  - `app/assets.ts` — allow workflow-parameters.tsx client entry in asset server
