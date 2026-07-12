## 1. Agent Setup

- [x] 1.1 Import `askUserTool` from `@mastra/core/tools` in `app/actions/mastra/agents/test-agent.ts`
- [x] 1.2 Add `askUserTool` to the agent's `tools` object
- [x] 1.3 Add instructions for when to use `askUserTool` (ambiguous requests, sorting, file selection)

## 2. SSE Handler

- [x] 2.1 Add `tool-call-suspended` chunk handling in `app/actions/test-agent/controller.tsx` SSE stream reader (after the existing `tool-call-approval` branch)
- [x] 2.2 Emit SSE `event: question` with payload `{ runId, toolCallId, question, options, selectionMode }`

## 3. Resume Endpoint

- [x] 3.1 Add `answer` action to the test agent controller that receives `answer`, `runId`, `toolCallId`
- [x] 3.2 Call `agent.resumeStream(answer, { runId })` and store the returned stream via `setStream`
- [x] 3.3 Return `{ runId, threadId }` for SSE continuation
- [x] 3.4 Add `toolCallId` param to the resume call for safety (so the agent knows which suspension to resume)

## 4. UI

- [x] 4.1 Create question card component that renders free-text input, single-select radio buttons, or multi-select checkboxes based on `selectionMode`
- [x] 4.2 Wire the test agent chat page to listen for `event: question` SSE events and render the question card
- [x] 4.3 Wire the question form submit to POST to the `answer` action
- [x] 4.4 Handle loading state while waiting for resume stream (show spinner on question card)

## 5. TypeScript / Lint

- [x] 5.1 Run `npm run typecheck` and fix any type errors
- [x] 5.2 Run `npm run lint` and fix any lint issues

## 6. Verify

- [x] 6.1 Manual test: send "sort the files" to test agent, confirm question card appears with sort options
- [x] 6.2 Manual test: select a sort option, confirm agent continues in same turn and returns sorted results
- [x] 6.3 Manual test: confirm existing `requireApproval` flow still works (workspace tool calls still show approval cards)
- [x] 6.4 Manual test: confirm `listTestFiles` without ambiguity still works without interruption
