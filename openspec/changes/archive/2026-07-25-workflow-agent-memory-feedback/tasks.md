## 1. Add Memory to Workflow Agent

- [x] 1.1 Import `Memory` from `@mastra/memory` in `workflow-agent.ts`
- [x] 1.2 Add `memory` config to the workflow agent with thread key strategy
- [x] 1.3 Derive thread ID from `admin-{userId}` with `APP_ENV` prefix

## 2. Extend pipeWorkflowStream Return Type

- [x] 2.1 Define `WorkflowResult` type in `workflow-sse.ts` with `success`, `action`, `targetUserId`, `targetUserName`, `deletedAppointments`, `auditLogged`, `error`
- [x] 2.2 Modify `pipeWorkflowStream` to capture and return `WorkflowResult` from `workflow-finish` event
- [x] 2.3 Handle error cases — stream error or no `workflow-finish` events produces error result

## 3. Wire Controller with Memory + Feedback

- [x] 3.1 Pass `memory: { thread: threadId }` to the intent-resolution `agent.generate()` call in `action` handler
- [x] 3.2 After `pipeWorkflowStream` returns, close the SSE controller, then make a best-effort feedback `agent.generate()` call with the workflow result
- [x] 3.3 Apply the same pattern to the `resume` handler (`/workflow-agent/resume`)

## 4. Tests

- [x] 4.1 Test that the agent thread is created on first interaction and reused on subsequent interactions
- [x] 4.2 Test that workflow result feedback is appended to the agent thread after successful execution
- [x] 4.3 Test that the feedback call does not block SSE `complete` delivery (timing assertion)
- [x] 4.4 Test that feedback failure is silently caught and does not crash the response
- [x] 4.5 Test that different admin users have separate threads