## 1. Consistency Workflow

- [x] 1.1 Create `app/actions/mastra/workflows/consistency-check-workflow.ts` with `.parallel()` structure
- [x] 1.2 Create step `checkLockedUsersPendingAppointments` querying locked users with pending appointment counts
- [x] 1.3 Register workflow in `app/actions/mastra/index.ts`

## 2. Agent Tool

- [x] 2.1 Create agent tool `run_consistency_checks` that triggers the workflow
- [x] 2.2 Add tool to workflow agent in `app/actions/mastra/agents/workflow-agent.ts`

## 3. Agent Instructions

- [x] 3.1 Replace query/workflow mode split with unified flow: navigate → ask_user("Ready?") → consistency checks
- [x] 3.2 Update ask_user instructions to always include "Ready" option plus action options

## 4. Verification

- [x] 4.1 Run typecheck
- [x] 4.2 Run workflow agent tests
