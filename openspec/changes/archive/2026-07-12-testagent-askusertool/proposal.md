## Why

The testAgent currently handles all user interaction through turn-based text: it finishes a turn, the user replies in a new message, and the agent re-derives context from memory. This breaks multi-step workflows where the agent needs structured user input mid-execution (e.g., "sort by size or name?"). Adding `askUserTool` enables the agent to suspend mid-turn, present structured choices (single-select, multi-select, or free-text), and continue the same execution run with the answer — preserving all internal state across the interruption.

This is an experiment to evaluate whether intra-turn questions provide a meaningful UX improvement over the existing turn-based pattern in the test agent.

## What Changes

- Add `askUserTool` to the test agent's toolset (imported from `@mastra/core/tools`)
- Update the test agent's instructions to use `askUserTool` when the user's request is ambiguous and the agent needs to clarify before proceeding
- Add `tool-call-suspended` chunk handling to the test agent's SSE stream handler in `app/actions/test-agent/controller.tsx`
- Add an SSE `event: question` emission for `tool-call-suspended` chunks carrying the question payload
- Add a `resume` action endpoint that calls `agent.resumeStream(answer, { runId })` to resume a suspended askUserTool call
- Add a question card UI component that renders free-text, single-select, and multi-select question types in the chat page
- Wire the question form in the UI to POST to the new `resume` action

## Capabilities

### New Capabilities

- `intra-turn-question`: The agent can suspend its turn, present a structured question to the user (free-text, single-select, or multi-select), receive the answer, and continue execution in the same run. Questions carry typed options with descriptions and a selection mode.

### Modified Capabilities

- `testagent-workspace-tools`: The test agent's toolset gains `askUserTool`. The instruction set learns when to use it.

## Impact

- `app/actions/mastra/agents/test-agent.ts` — import `askUserTool`, add to `tools`, update `instructions`
- `app/actions/test-agent/controller.tsx` — add `tool-call-suspended` SSE handler, add `resume` action
- `app/ui/test-agent-page.tsx` or a new `app/ui/` component — add question card UI
- No new dependencies — `askUserTool` is already in `@mastra/core/tools`
