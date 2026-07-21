## Why

The workflow agent currently has two distinct modes — "user query" (navigate to grid) and "workflow" (lock/unlock/cancel with ask_user). This split is unnecessary. Every interaction should follow the same pattern: show the grid, let the admin confirm they're done viewing, then run consistency checks. The consistency checks (starting with "which locked users have pending appointments") are a Mastra Workflow with parallel steps, ready for future checks without restructuring.

## What Changes

- Remove query/workflow mode distinction — unify into a single flow
- Unified flow: navigate to grid → ask_user("Ready?") → consistency check workflow → wait for next question
- The `ask_user` options include the admin's requested action (e.g., "Lock user 5") alongside a "Ready" baseline
- After the admin clicks Ready (or after action executes), the consistency workflow runs
- Create Mastra Workflow `consistencyCheckWorkflow` using `.parallel()` for extensible parallel checks
- First check: `checkLockedUsersPendingAppointments` — lists locked users with counts of future appointments
- Agent tool `run_consistency_checks` triggers the workflow and returns combined results

## Capabilities

### New Capabilities
- `consistency-workflow`: Mastra Workflow with parallel consistency checks, triggered after every user interaction
- `check-locked-users-pending-appts`: Query returning locked users with pending appointment counts

### Modified Capabilities
- `agent-query-navigation`: Unified query/workflow flow replaces the previous two-mode design

## Impact

- `app/actions/mastra/agents/workflow-agent.ts`: Replace query/workflow mode split with unified flow instructions
- `app/actions/mastra/workflows/consistency-check-workflow.ts`: New workflow with `.parallel()` steps
- `app/actions/mastra/workflows/steps/locked-users-pending-appts.ts`: Step implementation
- `app/actions/mastra/index.ts`: Register new workflow
