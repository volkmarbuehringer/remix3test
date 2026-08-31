## Context

See proposal.md — Why. Current state: `supportAgent` exposes `cancel_user_account`, `lock_user_account`, `unlock_user_account` as `requireApproval` tools. `lockUserAccount`/`unlockUserAccount` run inline SQL with **no audit logging**, while the newer agent-events pipeline routes the same actions through `userManagementWorkflow` → `executeLockUserWorkflow` / `executeUnlockUserWorkflow`, which are audited via `logAdminActionStrict` and gated by a durable suspend/resume confirm gate. `cancelUserAccount` already delegates to the same `executeCancelUserWorkflow` used by the pipeline.

## Goals / Non-Goals

**Goals:**
- Make the agent-events pipeline the **single owner** of account mutations by removing the three write tools from the support agent.
- Retire the non-auditing inline lock/unlock implementations (they die with the tools).
- Consolidate duplicated agent scaffolding (model + memory + tool composition) into one shared module.
- Keep the support agent's full read-only Q&A toolset intact.

**Non-Goals:**
- No change to `customerAgent`, the customer booking flow, or `customer-chat` behavior.
- No route/page removals or renames (`/support-agent`, `/admin/chatlog`, `/agent-events` stay).
- No changes to the agent-events pipeline, its workflows, or its run-store logic — it already does the right thing; this change only makes it authoritative.
- Not in scope: the individual `cancelUserWorkflow`/`lockUserWorkflow`/`unlockUserWorkflow` vs `userManagementWorkflow` duplication (adjacent, logged separately).

## Decisions

**D1 — Remove the tools at the registry, not the instruction layer.**
Delete the `cancelUserAccount`, `lockUserAccount`, `unlockUserAccount` entries from `supportTools` (`support-tools.ts`) and strip their lines + Rules from `support-agent.ts` instructions. Removing them from the tool registry is the hard guarantee: the LLM can never call what isn't registered, regardless of prompt phrasing.
- *Alternative considered*: keep the tools but gate calls behind intent classification. Rejected — it leaves the non-audited implementations reachable and re-introduces the duplication we're removing; intent-based routing belongs to the dedicated pipeline.

**D2 — Leave the agent-events pipeline as the authority without modifying it.**
`dispatch.ts` already maps `user-action:cancel|lock|unlock` → `userManagementWorkflow`, which runs the audited executors under `confirmGateStep` (durable suspension). No code change needed; we only remove the competing path. This is why the change is mostly deletions + a refactor.

**D3 — One strict `requireApiKey()` for all agents.**
Move `requireApiKey` from `customer-agent.ts` into `agent-config.ts`, export it, and drive a shared `createModel()` from it (lazy `get apiKey() { return requireApiKey() }`). Support and workflow agents previously passed `process.env.OPENCODE_API_KEY` verbatim; unifying to the strict getter makes all three **fail fast** on a missing key.
- *Alternative considered*: keep per-agent inline key reads. Rejected — inconsistent behavior and the whole point of the shared factory.

**D4 — `createMemory()` with per-agent option overrides.**
Support/customer use `workingMemory: { enabled: true }`; workflow uses `lastMessages: 10`. Provide `createMemory(options?)` that defaults to the working-memory config and lets each agent override options. All three read the same `mastraStorage`.

**D5 — Tool-composition helper.**
`withUserTools(tools)` spreads the agent-specific tools plus `askUserTool`; support additionally merges `routeNavigate` (its only extra). Keeps `…tools, askUserTool` duplication in one place.

**D6 — Frontend de-coupling.**
Remove the `cancel_user_account` special-case (`isCancelUser` branches) in `app/assets/streams/public/support-agent-stream.tsx`. The generic "tool requires confirmation" path stays (harmless if no support tool requires approval anymore).

## Risks / Trade-offs

- **[Support chat silently loses mutations]** → Update the support agent instructions to state account mutations are performed via "Agent-Events"; the admin no longer gets the red "Benutzerkonto löschen?" button in "KI Chat". Mitigation: explicit instructions + the migration note below.
- **[Removing tools breaks tests or stray callers]** → Scope is narrow (only support-agent-stream.tsx and controller.test.ts reference them in the repo); grep is clean apart from those plus the two agent files. Update controller.test.ts.
- **[Strict `requireApiKey` fails if env missing]** → Matches customerAgent already in production; ensure `OPENCODE_API_KEY` is set for support/workflow environments. Not a new requirement, just consistent.
- **[Audit-log change]** → Lock/unlock via the pipeline now writes `lock`/`unlock` audit entries (they were un-audited before). This is the intended improvement, but it changes log volume/content.
- **[Behavior shift for admins]** → The "KI Chat" no longer mutates. This is the consciously chosen trade-off (strict path); rollback = restore the three tool definitions.

## Migration Plan

1. Remove the three tool definitions + instruction references; delete the `cancel_user_account` stream special-case; drop the `cancelUserAccount` tests.
2. Add `createModel`/`createMemory`/`withUserTools`/`requireApiKey` to `agent-config.ts` (kept out of `shared-agent.ts`, which stays free of DB/storage coupling); rewire the three agent files.
3. Run `npm test` and `npm run typecheck`; verify the agent-events destructive-action flow still works (tests in `agent-events/controller.test.ts`, `workflows.test.ts`).
4. **Rollback**: restore the three tool definitions in `support-tools.ts` + the agent instructions; no migration of stored data is involved.

## Open Questions

- Should the "KI Chat" UI show a small hint that account mutations moved to "Agent-Events"? Deferred — it's a UI nicety that does not change the approach, the specs, or the task breakdown.
