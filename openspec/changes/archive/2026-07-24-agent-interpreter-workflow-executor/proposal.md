## Why

The workflow-agent currently uses an LLM agent as the top-level orchestrator — it decides *when* to lookup users, *when* to navigate, *when* to ask for confirmation, *when* to execute, and *when* to report. This means every interaction pays LLM token cost for deterministic protocol management. The agent instructions are ~80 lines of protocol boilerplate that never varies.

The underlying pattern for user management (cancel/lock/unlock) is always the same: preflight → confirm → execute → report. This should be a deterministic parent workflow. The agent's real value is intent resolution — figuring out what the admin wants from natural language. Once intent is resolved, a workflow should execute silently with a single binary confirm gate.

## What Changes

- Replace the current agent-as-orchestrator with a **two-phase model**: Agent resolves intent → Workflow executes
- Create a **parent `userManagementWorkflow`** with nested workflows for preflight, execution, and reporting, and a suspend-based binary confirm gate
- **Simplify the agent**: collapse ~80 lines of protocol instructions to ~10 lines of intent resolution
- **Replace the current SSE protocol** (agent stream events: message, question, suspension, navigate, complete) with **native Mastra workflow SSE** (`run.stream()` events: workflow-step-start, workflow-step-result, workflow-step-suspended, workflow-finish)
- The confirm gate moves from the agent's `askUserTool` to the workflow's `suspend()`/`resume()` — survives crashes, deploys, page refreshes
- The UI changes from a chat-bubble interface to a **status-progress interface** with a single binary confirm button at the gate point

## Capabilities

### New

- `user-management-workflow`: A `createWorkflow` parent that orchestrates preflight (parallel nested), binary confirm gate (suspend), execution (nested), and finalization (audit + report + navigate) as deterministic steps
- `workflow-sse-stream`: Native Mastra workflow streaming (`run.stream()`) piped directly to the client as SSE events — no custom SSE protocol, no transformation layer
- `suspend-confirm-gate`: The confirm gate uses `suspend()`/`resume()` on the workflow step with a typed `resumeSchema`, persisted as a snapshot in storage

### Modified

- `workflow-agent` (agent): Reduced to intent resolution only. No longer orchestrates protocol steps. Instructions simplified to: "interpret what the admin wants, return structured action metadata."
- `workflow-agent-page` (UI): Replaced chat-bubble rendering with workflow step status display and a binary confirm button rendered from suspend payload
- `controller.tsx`: POST `/workflow-agent` now starts the agent (fire-and-forget intent resolution), then starts the workflow stream. New POST `/workflow-agent/resume` resumes suspended step. New GET `/workflow-agent/stream` reconnects to an active workflow run.

### Removed

- `askUserTool` usage from the workflow-agent (replaced by workflow suspend)
- `routeNavigate` tool usage from the workflow-agent (navigation becomes a workflow finalization step)
- Three-agent SSE endpoints: `/answer`, `/tool-decision` — no longer needed
- Chat bubble rendering in the workflow-agent page
- ~300 lines of protocol instructions from the agent's prompt

## Impact

- **New file**: `app/actions/mastra/workflows/user-management-workflow.ts` — parent workflow with suspend gate
- **New file**: `app/actions/workflow-agent/workflow-sse.ts` — utility to pipe `run.stream()` events to the response
- **Modified**: `app/actions/mastra/agents/workflow-agent.ts` — strip protocol instructions, simplify to intent resolution only
- **Modified**: `app/actions/workflow-agent/controller.tsx` — three endpoints instead of five; workflow streaming replaces agent streaming
- **Modified**: `app/ui/workflow-agent-page.tsx` — progress UI instead of chat UI
- **Modified**: `app/assets/streams/workflow-agent-stream.browser.tsx` — handle workflow SSE events instead of agent SSE events
- **Removed**: `askUserTool`, `routeNavigate` from agent tools
- **No changes** to existing workflows (cancel-user, lock-user, unlock-user, user-preflight, consistency-check) — they remain as-is, invoked as nested workflows by the parent
