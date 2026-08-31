## Why

The admin panel has two independently-implemented code paths for the same destructive user actions (cancel / lock / unlock). The legacy `supportAgent` ("KI Chat") exposes them as `requireApproval` tools that bypass the audited, durable confirm+execute workflow built into the newer agent-events pipeline. Two paths for account mutations means the legacy, **non-audited** implementations (lock/unlock) stay live, and destructive behavior is spread across two admin surfaces.

## What Changes

- **BREAKING — single owner for account mutations.** Remove the `cancel_user_account`, `lock_user_account`, and `unlock_user_account` tools from the support agent. The support agent (routes `/support-agent`, `/admin/chatlog`) becomes **read-only** for account mutations; it keeps its full Q&A toolset (lookup, appointments, resources, offerings, weather, stats, PDF, messages, navigate, ask_user).
- Destructive account actions (cancel / lock / unlock) are now performed **only** through the agent-events pipeline (`/agent-events` → `intent.classified` → `userManagementWorkflow`), which runs the audited `lockUserWorkflow` / `unlockUserWorkflow` / `cancelUserWorkflow` under a durable, resumable confirmation gate. This retires the non-auditing inline implementations in the old tools.
- Remove the `cancel_user_account` confirmation special-case from `app/assets/streams/public/support-agent-stream.tsx` (the support agent no longer emits that suspension).
- Drop / adapt the `cancelUserAccount` tool tests in `app/actions/support-agent/controller.test.ts`.
- **Refactor — shared agent scaffolding (no behavior change for read paths).** Extract a `createModel()`, `createMemory()`, and tool-composition helper into `app/actions/mastra/agent-config.ts` and use them in all three agents, removing ~40 lines of duplicated model/memory/tool wiring.
- Unify the divergent `apiKey` handling behind one strict `requireApiKey()` getter (support/workflow previously passed `process.env.OPENCODE_API_KEY` verbatim; they now fail fast like `customerAgent` when the key is missing).
- Adjacent cleanup: factor the near-identical appointment reads across `support-tools.ts` and `customer-tools.ts` into one shared data-access module (optional).

## Capabilities

### New Capabilities

None. This does not introduce a new behavior surface; the destructive-action path already exists under the agent-events specs.

### Modified Capabilities

- `support-agent-tools`: the support agent SHALL no longer expose the `lock_user_account`, `unlock_user_account`, or `cancel_user_account` tools. The `Lock user account` and `Unlock user account` requirements (and any `cancel_user_account` behavior) are removed from the support agent toolset, which becomes read-only for account mutations. Destructive actions move to the agent-events pipeline (covered by `agent-events-confirm-execute`).

## Impact

- **Code**: `app/actions/mastra/tools/support-tools.ts`, `app/actions/mastra/agents/support-agent.ts`, `app/actions/mastra/agent-config.ts`, `app/actions/mastra/agents/{customer,workflow}-agent.ts`, `app/assets/streams/public/support-agent-stream.tsx`, `app/actions/support-agent/controller.test.ts`.
- **Behavior**: account mutations on the support agent change from inline (lock/unlock, un-audited) to unavailable; they are reached via `/agent-events`. Lock/unlock/cancel performed there are now audited and gated.
- **Screens**: "KI Chat" no longer performs destructive user actions; "Agent-Events" is the surface for them.
- **Configuration**: `OPENCODE_API_KEY` is now required at model-access time for all agents (fail-fast), matching `customerAgent`.
- **Non-goals**: no change to `customerAgent` (customer booking); no route removals; the agent-events pipeline and its workflows are unchanged except that they are now the sole owner of account mutations.
