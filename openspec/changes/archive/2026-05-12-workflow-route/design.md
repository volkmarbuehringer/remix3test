## Context

The `my_app` project has a fully functional workflow engine with types, registry, execution engine, tool integrations, three workflow definitions (restock analysis, trending report, create purchase order), and a Postgres-backed `workflow_runs` table. Newapp already has the AI infrastructure in place: the `/ai/` route section with sidebar layout, auth middleware, Postgres database with `remix/data-table-postgres`, and the same AI provider SDK. Porting the workflow engine is a matter of adapting my_app's workflow files to use newapp's conventions (theme system, button component, AI layout, auth middleware, route structure).

## Goals / Non-Goals

**Goals:**

- Copy the complete workflow engine from my_app to newapp (types, registry, engine, tools, definitions)
- Wire it at `/ai/workflow` as a sub-route under the existing AI section
- Adapt all UI to use newapp's theme token system (`app/theme.tsx`) and `Button` from `remix/ui/button`
- Use the AI sidebar layout (`renderAiPage`) for consistency with Chat and Agent
- Require authentication (consistent with other AI routes)
- Add `workflow_runs` table to the database schema

**Non-Goals:**

- No changes to the workflow engine logic itself (straight port)
- No new workflow definitions beyond what my_app has
- No changes to existing AI routes (Chat, Agent)
- No changes to existing middleware or context types

## Decisions

**Decision 1: Port engine files verbatim, only adapt imports**

- `app/workflows/types.ts`, `registry.ts`, `engine.ts`, `tools.ts` are pure logic with no UI dependencies — they can be copied as-is with minor import path adjustments
- The engine uses `ai` SDK's `tool()` and `generateText` which newapp already depends on

**Decision 2: Route at `/ai/workflow` using existing aiRoutes pattern**

```ts
workflow: route('workflow', {
  index: get('/'),
  action: post('/'),
})
```

Mounted under the `ai` prefix via `routes.ai.workflow`, giving `/ai/workflow`.

**Decision 3: Controller uses `renderAiPage` for AI sidebar integration**

- Workflow controller wraps pages in `renderAiPage(render, 'workflow', ...)` instead of the old `<Layout>` wrapper
- This ensures frame-based navigation works within the AI section

**Decision 4: Adapt page CSS from my_app's inline styles to newapp's theme token system**

- my_app's workflow pages define CSS with hardcoded color values
- These need conversion to use `theme.colors.*`, `theme.surface.*`, `theme.space.*`, etc. from `app/theme.tsx`
- Buttons use `<Button>` from `remix/ui/button` with proper `tone` prop instead of raw `<button>` elements

**Decision 5: Client entry for workflow parameters**

- `AppUiWorkflowParameters` from my_app (`/home/lucky/alpha4/my_app/app/ui/workflow-parameters.tsx`) needs to be ported as-is
- It needs to be allowed in the asset server's `allow` list

## Risks / Trade-offs

- **[Low] Workflow engine depends on AI provider** — newapp already has `getModel()` in `app/utils/ai-provider.ts` so this is handled
- **[Low] Database schema addition** — adding the `workflow_runs` table is safe (new table, no migration needed for existing data)
- **[Low] Workflow definitions reference sample data** — the `restock-analysis` and `trending-report` workflows reference a `books` table and `out_of_stock` column which may not exist in newapp's schema. These will need minor adaptation or the workflows will return errors gracefully.
- **[Medium] UI adaptation effort** — converting my_app's CSS to newapp's theme system requires careful mapping of color values to theme tokens
