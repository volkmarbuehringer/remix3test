## Context

See `proposal.md` — Why. The `supportAgent` route handler currently lives as a generic-looking `mastraChat` controller in `app/actions/mastra/controller.tsx` (388 lines) and is exposed to `app/router.ts` through a one-line re-export at `app/actions/admin/support-agent/controller.tsx`. The route map is `routes.admin.supportAgent` → `admin.supportAgent` (re-exported by `app/actions/admin/controller.tsx`). The sibling `workflow-agent` and `agent-events` each own a colocated top-level `app/actions/<agent>/controller.tsx` with a colocated test.

Constraint that shapes the approach: `app/actions/mastra/controller.tsx` has exactly two consumers — the `admin/support-agent` re-export and its own `controller.test.ts`. Nothing else imports it. So it is support-agent-specific in disguise and can be lifted wholesale.

## Goals / Non-Goals

**Goals:**
- Make support-agent a first-class colocated controller at `app/actions/support-agent/controller.tsx`, structurally parallel to `workflow-agent` and `agent-events`.
- Preserve **all** route behavior, SSE event payloads, rate limiting, timeout, audit logging, tool-approval flow, and the client stream exactly.
- Move the dedicated test surface next to the controller.
- Retire the misnamed shared `mastraChat` module and the one-line `admin/support-agent` shell.

**Non-Goals:**
- Durable reconnect / confirm-gate resurfacing (deferred to a follow-up change).
- Any change to the support-agent's tools, prompt, frame layout, navigation, `pipStream`/`agent-sse.ts`, or `support-agent-stream.tsx`.
- No changes to `agent-events` or `workflow-agent`.

## Decisions

**1. Destination directory: `app/actions/support-agent/` (top-level), not `app/actions/admin/support-agent/`.**
`workflow-agent` and `agent-events` are admin *routes* but keep top-level `app/actions/<agent>/controller.tsx`, re-exported through `admin/controller.tsx`. Keeping support-agent under `admin/` would be the odd one out. Moving it to `app/actions/support-agent/` and re-exporting `{ supportAgentChat as supportAgent } from '../support-agent/controller.tsx'` mirrors the siblings exactly.
- *Alternative considered*: leave it at `app/actions/admin/support-agent/`. Rejected — inconsistent with the established sibling layout and the `controller-feature-colocation` convention.

**2. Delete `app/actions/mastra/controller.tsx` and `mastra/controller.test.ts`.**
The shared `mastraChat` has no second consumer. A single-consumer "generic" is a misnomer; folding it out removes the indirection. The rest of `app/actions/mastra/` (agents, tools, workflows, scorers, `index.ts`, `shared-agent.ts`, `storage.ts`, `workflow-executor.ts`, notifications) stays exactly where it is — this is the "Mastra agent subsystem, not a route-controller group" boundary that remains in the spec.
- *Alternative considered*: keep `mastra/controller.tsx` as a reusable chat controller. Rejected — nothing else uses it, and keeping it perpetuates the mislabeling and the re-export shell.

**3. Import path adjustment is mechanical — only `./` (mastra-local) references change.**
Both `app/actions/mastra/` and `app/actions/support-agent/` sit at `app/actions/<dir>/`, so every `../../*` import (middleware, utils, routes, db, data, ui, theme) stays identical. Within the moved files, the mastra-local imports change:
- `./index.ts` → `../mastra/index.ts`
- `./tools/admin-context.ts` → `../mastra/tools/admin-context.ts`
- `./shared-agent.ts` (import + type import) → `../mastra/shared-agent.ts`
- In the test: additionally `./tools/support-tools.ts` → `../mastra/tools/support-tools.ts`

**4. Handler renamed to `supportAgentChat`; approval-flow handlers honor the test seam.**
Since the controller is now support-agent-specific, the exported handler is named `supportAgentChat` (not `mastraChat`), and `admin/controller.tsx` re-exports it as `export { supportAgentChat as supportAgent } from '../support-agent/controller.tsx'`. The `__setTestAgent` seam was extended so `toolDecision` and `answer` also resolve the injected test agent via a shared `resolveAgent()` helper (previously they always used the real `mastra.getAgent('supportAgent')`, blocking deterministic tests of the approval flow).

## Risks / Trade-offs

- **[Transcription drift during relocation]** → Copy the controller and test files wholesale (content-preserving) rather than retyping; the existing `mastra/controller.test.ts` exercises all action paths, so it is the parity guard. Run it before and after.
- **[git blame / history]** → Prefer `git mv` where possible. The controller is a block inside a larger file, so a clean `git mv` of that block isn't possible by itself; use `git mv` for the test and create the new controller via a content-identical copy, then delete the old file.
- **[Stale references if a consumer is missed]** → Verified the only two consumers are the `admin/support-agent` re-export and `mastra/controller.test.ts`; grep `mastraChat` / `mastra/controller` after the move to confirm zero remaining references.
- **[No behavioral safety net beyond the existing test]** → The move is structural only; no schema, config, or dependency changes, so risk is confined to import correctness and file wiring.

## Migration Plan

No production deploy concern — this is a code relocation with identical runtime behavior.
1. Create `app/actions/support-agent/controller.tsx` from `mastra/controller.tsx`, adjusting mastra-local imports.
2. Create `app/actions/support-agent/controller.test.ts` from `mastra/controller.test.ts`, adjusting imports.
3. Update `app/actions/admin/controller.tsx` re-export to `'../support-agent/controller.tsx'`.
4. Delete `app/actions/admin/support-agent/controller.tsx` and `app/actions/mastra/controller.tsx` (+ `mastra/controller.test.ts`).
5. Run the moved test suite, typecheck, and lint.
6. **Rollback**: revert the single commit. No data migration or config to unwind.

## Open Questions

None that would change the approach.
