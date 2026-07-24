## Why

The Workflow Agent's cancellation/lock/unlock protocols require 3-4 separate tool calls for preflight data (user lookup, pending appointment check, consistency checks). This increases prompt surface area (~40 lines of step-by-step protocol), makes the protocol fragile to LLM drift, and means consistency check data can be missed if the agent forgets a tool call. Extracting preflight into a deterministic Mastra Workflow guarantees parallel execution, typed output, and removes the consistency checks from the agent's responsibility.

## What Changes

- Create a `userPreflightWorkflow` Mastra Workflow that runs user lookup, pending appointment count, and consistency checks in parallel
- Modify `cancelUserWorkflow_v2`, `lockUserWorkflow_v2`, `unlockUserWorkflow_v2` tools to use the preflight workflow for their `confirmed=false` path instead of inline `db.exec`
- Remove the standalone `checkPendingAppointments` and `runConsistencyChecks` tools from the agent — their data is embedded in the preflight output
- Shrink the agent prompt protocol steps from 9 steps per action to "call preflight → present → confirm → execute"
- Add a `preflightWorkflow` executor function to `workflow-executor.ts`

## Capabilities

### New Capabilities
- `workflow-agent-preflight`: Deterministic Mastra Workflow that assembles user lookup, pending appointment count, and system consistency checks in parallel, returning typed output for the agent to present

### Modified Capabilities
- `workflow-agent-cancel-report`: Preflight data source changes from separate tool calls to workflow output

## Impact

- `app/actions/mastra/workflows/`: New `user-preflight-workflow.ts`
- `app/actions/mastra/workflow-executor.ts`: New `executeUserPreflightWorkflow()`
- `app/actions/mastra/agents/workflow-agent.ts`: Tool implementations simplified, prompt shortened
- `app/actions/mastra/index.ts`: Register new workflow
- `app/actions/mastra/workflows/consistency-check-workflow.ts`: Reused by the preflight workflow (not duplicated)
