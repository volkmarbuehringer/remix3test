## Context

The app registers five Mastra agents in `app/actions/mastra/index.ts`. Two are being retired: `routeAgent` (an agentic-routing POC whose toolset was absorbed into `supportAgent`) and `testAgent` (a dev-only filesystem-explorer prototype). See proposal.md for motivation. The specs deltas define the requirement removals; this design covers how to execute the retirement cleanly.

Current wiring that must be unwound:

```
registry          app/actions/mastra/index.ts          agents: { support, customer, test, route, workflow }
routes            app/routes.ts                        testAgent: /testagent, routeAgent: /route-agent
router            app/router.ts                        maps both controllers
controllers       app/actions/{test-agent,route-agent}/controller.tsx
pages             app/ui/{test-agent,route-agent}-page.tsx
browser streams   app/assets/streams/public/{test-agent,route-agent}-stream.tsx
tools             app/actions/mastra/tools/{test-tools.ts, route-find-list.ts, route-navigate.ts}
nav               app/ui/nav.ts (Route-Agent), app/ui/admin-layout.tsx (Test-Agent + icon)
middleware        app/middleware/skip-csrf.ts (AGENT_PATHS), app/utils/frame-utils.ts (CONTAINER_IDS)
tests             app/actions/test-agent/controller.test.ts, app/assets/streams/streams.test.browser.tsx
```

## Goals / Non-Goals

**Goals:**
- Remove `routeAgent` and `testAgent` end-to-end: registry, routes, router maps, controllers, pages, browser streams, agent tools, nav entries, CSRF/frame-utils touchpoints, and their tests.
- Keep the shared tooling that surviving agents depend on.
- Land the retirement with a green typecheck, lint, and test suite.

**Non-Goals:**
- Retiring the `/admin/workflow-agent` panel or `workflowAgent` — that is a separate decision (the agent is still the intent classifier for `agent-events`).
- Removing `routeNavigate` / `askUserTool` — `supportAgent` still uses them.
- Touching `app/actions/mastra/controller.tsx`'s `_testAgent` / `__setTestAgent` — despite the name, that is a **support-agent** test seam (a `TestAgent`-typed stub for `supportAgent`), unrelated to the `testAgent` agent.

## Decisions

**D1 — Delete consumers before removing the agents from the registry.** Remove routes, controllers, pages, streams, and tools first; remove `testAgent`/`routeAgent` from `app/actions/mastra/index.ts` and delete `agents/test-agent.ts` + `agents/route-agent.ts` last. The registry is the single source of truth — deleting it while consumers still import it breaks the build, so it goes last.

**D2 — Keep `route-navigate.ts`; delete `route-find-list.ts`.** `supportAgent` imports `routeNavigate`, so `route-navigate.ts` is preserved. `findList` (`route-find-list.ts`) has no surviving importer once both agents are gone — the proposal's delete-if-unused conditional holds, so it is deleted with the rest of the retired tooling. Verify with a `grep` for remaining importers after the deletion pass.

**D3 — Prune shared touchpoints rather than leaving stale references:**
- `app/utils/frame-utils.ts`: drop `route-agent-frame-container` from `CONTAINER_IDS` (support-agent container stays).
- `app/middleware/skip-csrf.ts`: drop `/testagent` and `/route-agent` from `AGENT_PATHS`.
- `app/assets/streams/streams.test.browser.tsx`: remove the `TestAgentStream` / `RouteAgentStream` imports and their test blocks.
- `app/route-labels.ts`: no changes needed (no route-agent/test-agent entries).

**D4 — Deletion order (bottom-up, typecheck-green at each step):**
1. Browser streams + their test references
2. UI pages
3. Controllers + controller tests
4. Routes (`routes.ts`) + router maps (`router.ts`) + nav entries (`nav.ts`, `admin-layout.tsx`)
5. CSRF + frame-utils touchpoints
6. Agent tools (`test-tools.ts`, `test-tools.test.ts`) and agent files (`agents/test-agent.ts`, `agents/route-agent.ts`)
7. Registry entry in `app/actions/mastra/index.ts`

**D5 — Gate on the existing checks.** Run `npm run typecheck`, `npm run lint`, and `npm test` after the deletion pass; the route-agent controller has no test file, so the main regression risk is a missed import, which `tsc` catches.

## Risks / Trade-offs

- [Missed importer of a deleted module] → Run `tsc --noEmit` (project uses TS7, catches unused/deleted imports) and grep for `route-agent|testagent|routeAgent|testAgent` across `app/` after the pass; the deletion log in `docs/DELETION_LOG.md` should record the removal.
- [Accidentally deleting `route-navigate.ts`, breaking `supportAgent`] → It is kept (D2); add a grep assertion that `supportAgent` still imports `routeNavigate`. `route-find-list.ts` deletion is intentional — no surviving agent imports `findList`.
- [Confusing the support-agent `_testAgent` seam with the retired `testAgent`] → Explicitly out of scope (Non-Goals); leave `mastra/controller.tsx` untouched.
- [Archived OpenSpec docs still describing the retired agents] → The specs deltas (REMOVED requirements) handle this at archive time; no manual main-spec edits needed now.

## Migration Plan

Single commit retiring both agents. No database changes, no external API changes — the only externally visible effect is that `/route-agent` and `/testagent` (and their sub-routes) return 404. Rollback is `git revert` of the commit; nothing is migrated or irreversible.

## Open Questions

None — the two deferrable unknowns (whether to also retire the workflow-agent panel, and whether the user relies on `testAgent` as a personal dev tool) were resolved: the panel is a separate change, and the user confirmed both agents are retired.