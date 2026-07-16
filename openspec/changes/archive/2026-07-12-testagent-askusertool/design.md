## Context

The test agent (app/actions/mastra/agents/test-agent.ts) is a stream-based Mastra agent used for project file exploration. It has 8 workspace tools (most with requireApproval) plus a custom `listTestFiles` tool. User interaction is turn-based: agent finishes a stream, user types a new message, agent starts a new stream.

The SSE handler (app/actions/test-agent/controller.tsx) processes three stream chunk types: `text-delta`, `tool-call-approval`, and `finish`. `tool-call-suspended` — the chunk type emitted when a tool calls `suspend()` — is not handled.

`askUserTool` is exported from `@mastra/core/tools` and is already available in the dependency tree. It uses the `suspend()` primitive internally, which causes the agent stream to emit a `tool-call-suspended` chunk with payload `{ toolCallId, toolName: "ask_user", suspendPayload: { question, options?, selectionMode? } }`.

## Goals / Non-Goals

**Goals:**

- The test agent can present structured questions to the user mid-turn (free-text, single-select, multi-select)
- The user's answer resumes the same agent run, preserving internal state
- The existing approve/decline flow for requireApproval tools is unaffected
- The UI renders a question card appropriate for the selection mode

**Non-Goals:**

- Adding askUserTool to other agents (support, customer) — scoped to test agent only
- Replacing the turn-based pattern — askUserTool is additive for cases where the agent needs clarification
- Sophisticated question card styling — functional first

## Decisions

### Decision 1: Reuse the stream-store pattern for resume streams

The existing `approve` action calls `approveToolCallGenerate` and stores the resulting stream. The `resume` action will follow the same pattern: call `agent.resumeStream(answer, { runId })`, store the returned stream, and return `{ runId }` to the client for SSE consumption. This reuses `setStream`, `getStream`, the `StoredStream` interface, and the SSE endpoint without modification.

**Alternatives considered:**

- Using `resumeGenerate` instead — would lose streaming UX for the continuation
- Inline resume without stream-store — would break the existing SSE architecture

### Decision 2: New `answer` action, not overloading `approve`

`approveToolCallGenerate` and `resumeStream` are different methods with different signatures. `approve` takes `{ runId, toolCallId }` and returns a result immediately. `resumeStream` takes `(answerData, { runId })` and returns a `MastraModelOutput` with a stream. Overloading the existing `approve` endpoint would require branching logic to detect which method to call. A separate `answer` endpoint is cleaner.

### Decision 3: Detect `tool-call-suspended` by chunk type in SSE handler

The SSE handler already branches on `chunk.type`. Adding `else if (chunk.type === 'tool-call-suspended')` is the natural extension. The handler extracts `suspendPayload.question`, `suspendPayload.options`, and `suspendPayload.selectionMode` from the chunk and emits `event: question`.

**Why not treat it as an approval-like event:** `tool-call-suspended` and `tool-call-approval` have different payload shapes and different continuation methods. Conflating them in a single event type would shift the branching logic to the client, which has less context.

### Decision 4: Agent instructions describe WHEN to use askUserTool, not HOW

The tool's input schema (question, options, selectionMode) is self-documenting. The instructions only need to tell the agent when to reach for it — specifically, when the user's request is ambiguous and the agent needs to choose between multiple valid paths before proceeding.

## Risks / Trade-offs

- **[Double suspension]** If the agent calls askUserTool and then calls a requireApproval tool in the same step, the user sees a question followed by an approval card. The agent instructions should discourage this pattern — prefer one suspension type per step.
- **[Agent overuse]** The agent might ask too many questions. Mitigation: instructions emphasize "when genuinely ambiguous" and the initial rollout limits the tool to specific scenarios (sort criteria, file selection).
- **[SSE complexity]** The SSE stream now has three event types (message, suspension, question). The client-side event router needs to handle all three. Mitigation: the pattern is already established — adding one more case is straightforward.
- **[Backward compatibility]** Existing conversations continue using the turn-based pattern. askUserTool only fires when the agent decides to use it — no breaking changes to existing threads.

## Open Questions

- Should the answer action accept `_action` routing like the customer chat controller, or have its own dedicated endpoint?
- Should free-text answers include a character limit to prevent abuse?
