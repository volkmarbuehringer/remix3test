## Context

The Workflow Agent currently uses separate tools for user lookup, pending appointment checks, and consistency checks — each an independent round-trip the LLM must sequence. The consistency check workflow (`consistencyCheckWorkflow`) already exists as a Mastra Workflow with parallel steps, but the agent calls it as a separate tool after execution rather than having its data available at preflight time.

The cancel/lock/unlock tools (`cancelUserWorkflow_v2` etc.) use a two-call handshake — `confirmed=false` does an inline `db.exec` lookup, `confirmed=true` delegates to the Mastra execution workflow. The preflight data (user info + pending count + consistency snapshot) is assembled piecemeal across 3-4 tool calls.

## Goals / Non-Goals

**Goals:**
- Extract preflight data assembly into a single deterministic Mastra Workflow (parallel steps)
- Make consistency check data available *before* the execution decision, not after
- Remove the `checkPendingAppointments` and `runConsistencyChecks` tools from the agent
- Reduce the agent prompt protocol from 9 steps to 3-4
- Reuse the existing `consistencyCheckWorkflow` steps rather than duplicating them

**Non-Goals:**
- Change the execution workflows (`cancelUserWorkflow`, `lockUserWorkflow`, `unlockUserWorkflow`)
- Change the `generate_action_report` tool or its output shape
- Change the two-call handshake pattern (confirmed=false/true)
- Address the Support Agent's direct SQL lock/unlock (separate concern)

## Decisions

**1. Single preflight workflow with parallel branches, not separate workflows per action type**
- One `userPreflightWorkflow` that accepts `{ targetUserId, adminUserId }` and returns all preflight data
- The cancel/lock/unlock tools all share the same preflight needs (user lookup + consistency state)
- Avoids three near-identical workflow files

```
┌──────────────────────────────────────────────────────────┐
│                 userPreflightWorkflow                     │
│                                                          │
│  input: { targetUserId, adminUserId }                    │
│                                                          │
│  .parallel([                                             │
│    lookupUser ──────────→ { id, name, email, role,       │
│    checkPendingApps ────→   disabledAt, pendingCount }   │
│    checkLockedUsers ────→ { lockedUsers[], lockedTotal } │
│    checkActiveUsers ────→ { activeUsers[], activeTotal } │
│  ])                                                      │
│                                                          │
│  output: {                                               │
│    found: boolean,                                       │
│    user: { id, name, email, role, disabledAt },          │
│    pendingCount: number,                                 │
│    lockedUsers: UserWithPending[],                       │
│    lockedTotal: number,                                  │
│    activeUsers: UserWithPending[],                       │
│    activeTotal: number,                                  │
│    error?: string,                                       │
│  }                                                       │
└──────────────────────────────────────────────────────────┘
```

**2. Reuse consistency check steps, not duplicate them**
- The `checkLockedUsersPendingAppointments` and `checkActiveUsersPendingAppointments` steps from `consistencyCheckWorkflow` are exported and reused in the preflight workflow
- `consistencyCheckWorkflow` remains as-is (it's also used independently)
- Preflight workflow just wraps them in its own `.parallel([])` alongside the user-specific steps

**3. Tools consume preflight output directly**
- `cancelUserWorkflow_v2` / `lockUserWorkflow_v2` / `unlockUserWorkflow_v2`:
  - `confirmed=false`: call `executeUserPreflightWorkflow()`, return the output
  - `confirmed=true`: unchanged, still calls the execution workflow
- The `checkPendingAppointments` and `runConsistencyChecks` tools are removed — their data is embedded in the preflight output

**4. Prompt shrinks, agent still owns the conversation**
- Protocol steps collapse:
  ```
  Before:                         After:
  1. lookupUser                   → 1. preflightWorkflow(userId)
  2. navigate(path)               → 2. navigate(path)
  3. checkPendingApps(userId)     → 3. present data, ask_user if needed
  4. ask_user("Delete?")          → 4. execute(userId, confirmed=true)
  5. execute(userId, confirmed)   → 5. generateActionReport(...)
  6. navigate(path) [refresh]
  7. runConsistencyChecks
  8. generateActionReport(...)
  ```

## Risks / Trade-offs

**[Complexity] Preflight includes consistency data that's already available after execution**
→ Mitigation: Consistency data at preflight time gives the admin context before deciding. The execution workflow doesn't change consistency state (it affects one user), so preflight data is still valid post-execution. The agent can present the same data in the report.

**[Coupling] Preflight workflow imports steps from consistency check workflow**
→ Mitigation: Imported steps are stable query logic. If consistency check requirements change, they change in one place and both workflows pick it up.

**[Agent behavior] Removing tools means existing agent threads with checkpointed state reference old tool IDs**
→ Mitigation: This is a breaking change for in-flight threads. Only relevant if threads survive deployment (they use persistent storage). Existing threads with pending `runConsistencyChecks` tool calls would fail. Acceptable for this stage.

## Open Questions

- Should the preflight workflow compute `navigateTo` (the filter URL) or leave that to the agent? Currently each tool constructs `navigate.path` from the user name. The workflow could return the user object and let the agent build the URL, or the workflow could build it.
- Should this be done for all three action types at once, or rollout cancel first?
