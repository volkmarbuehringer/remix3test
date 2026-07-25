## Why

The workflow agent resolves intent and dispatches workflows, but has no memory of past interactions and never learns whether the workflow succeeded or failed. This means:

- Follow-up queries like "now unlock them" force the admin to re-specify the user because the agent doesn't remember prior context
- Queries like "did it work?" or "what did I just do?" are unanswerable because the agent never receives workflow results
- Each turn starts from zero conversational context, making the agent feel stateless

Adding persistent per-admin memory with workflow-result feedback closes the loop — the agent remembers conversation context AND knows what happened after each action.

## What Changes

- Add Mastra memory to the workflow agent with a per-admin thread key (`admin-{userId}`)
- After workflow completion, feed a structured summary of the result back into the agent's thread
- Apply the same feedback pattern to the resume (confirm-gate) path
- Encode workflow results into the feedback without blocking the SSE stream

## Capabilities

### New Capabilities
- `workflow-agent-memory`: Persistent per-admin conversation memory with thread lifecycle management, including result feedback after workflow execution

### Modified Capabilities
- (none — no existing spec-level requirements change; this adds new behavior on top of existing agent and workflow infrastructure)

## Impact

- `app/actions/mastra/agents/workflow-agent.ts` — add memory config, thread key strategy
- `app/actions/workflow-agent/controller.tsx` — pass thread to agent.generate(), capture workflow result, make feedback call
- `app/actions/workflow-agent/workflow-sse.ts` — return workflow result summary from pipeWorkflowStream so the caller can use it for feedback
- `app/actions/workflow-agent/controller.test.ts` — new tests for memory persistence, result feedback, thread lifecycle
