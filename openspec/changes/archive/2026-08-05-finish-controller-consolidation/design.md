## Context

The repo is mid-migration to a **controller consolidation** convention (`consolidate-auth-controller` + spec `controller-feature-colocation`). `remix doctor` enforces a different convention (one `controller.tsx` per route *node* at a kebab path); the repo convention is one `controller.tsx` per route *group* with named exports. These are incompatible, so the doctor's action-layout warnings are treated as non-gating (decision D). This change finishes rolling consolidation to `admin/*` and `verwaltung/*`, plus remaining top-level/`system` groups.

## Goals / Non-Goals

**Goals:**

- Each route *group* → one `app/actions/<group>/controller.tsx` that is the single entry point re-exporting every handler as a named export; `app/router.ts` imports the group from that single module.
- Realize the single entry point via **re-export hub** (no file moves for large groups): `admin/controller.tsx` re-exports existing subgroup modules by path and `app/router.ts` drops the per-route imports. This delivers the consolidation convention (one import per group, named exports) without the depth-rewrite churn/risk of physically inlining ~2500 lines of security-sensitive admin/SSE/agent code.
- Keep `mastra/` in place (it is the whole agent subsystem, not just a controller); `admin/controller.tsx` re-exports its `supportAgent` handler via a thin `export { mastraChat as supportAgent } from '../mastra/controller.tsx'`.

**Non-Goals:**

- Changing route behavior, URLs, or HTTP semantics.
- Renaming route-map keys to please the doctor.
- Making `remix doctor` fully green — explicitly abandoned.
- Moving/merging the `mastra` agent subsystem (`agents/`, `tools/`, `workflows/`, `scorers/`, `notifications/`, `index.ts`, `shared-agent.ts`, `storage.ts`, `workflow-executor.ts`).

## Decisions

0. **Re-export hub, not physical inline** — consolidation is implemented by making `admin/controller.tsx` the single re-export entry for the group and updating `router.ts` to import the group from it. Physical inlining/relocation of subgroup modules is deferred (see Goals). The doctor warnings for the still-present subgroup directories remain, and are accepted as non-gating.

1. **Named exports, no default** — every handler is exposed as a named export (`adminNutzer`, `adminClient`, `workflowAgent`, `agentEvents`, `supportAgent`, `adminController`, …). Source modules keep their own default/named exports; the hub re-exports them under group-prefixed names.

2. **Pages/support modules stay as separate files, not inlined** — unlike auth (which had inline pages), admin groups import large page components and SSE/event-bus helpers from sibling files. These are **relocated** (not inlined) into `admin/` with names that avoid collisions, e.g.:
   - `client/page.tsx`, `client/create-page.tsx`, `client/edit-page.tsx`, `client/grid-page.tsx` → `admin/client-page.tsx`, `admin/client-create-page.tsx`, `admin/client-edit-page.tsx`, `admin/client-grid-page.tsx`
   - `agent-events/event-bus.ts`, `intents.ts`, `register.ts`, `handlers/` → `admin/agent-events-*.ts` / `admin/agent-events/handlers/`
   - `workflow-agent/workflow-sse.ts` → `admin/workflow-sse.ts`
   The merged `admin/controller.tsx` imports them via `./<relocated-name>`. Their internal relative imports are fixed for the new depth (`../../` → `../../../`).

3. **Depth-aware import rewrite** — moving files one level deeper into `admin/` shifts shared-import depth by one (`../../x` → `../../../x`). This is applied mechanically to every moved module and verified by `npm run typecheck`. Sibling-to-sibling imports (`./foo`) are unaffected because the file moves with its siblings.

4. **`mastra` stays coupled, not merged** — `supportAgent` is wired to `mastra/controller.tsx`'s `mastraChat`. `admin/controller.tsx` re-exports it: `export { mastraChat as supportAgent } from '../mastra/controller.tsx'`. The `mastra/` directory (and its doctor "orphan" warning) is intentionally retained.

5. **Tests move with their controllers** — every `*.test.ts(x)` in a moved directory is relocated beside its new module so `./controller.tsx` / `./<name>.tsx` imports keep resolving. `npm test` is run after each phase.

6. **Non-gating doctor** — the ADR note records that `remix doctor` action-layout warnings are expected/non-gating. If a future `remix` version ships config to scope the doctor, adopt it.

## Risks / Trade-offs

- **Doctor warning count rises** — consolidation removes the per-node files the doctor wanted; accepted.
- **Depth-import churn** — the one-level-deeper move requires rewriting shared-import depth; verified by typecheck, not by hand-guessing.
- **Large `admin/controller.tsx`** — expected; keep handlers as clearly separated named `createController` blocks.
- **`git mv` history** — all moves use `git mv`; merges of inlined handlers use copy+delete.
- **Rollback** — file moves + import rewrites are reversible per phase via `git checkout` / `git mv` back.
