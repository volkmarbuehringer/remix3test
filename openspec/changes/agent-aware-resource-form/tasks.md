## 1. Controller agent branch

- [x] 1.1 In `app/actions/verwaltung/resources/controller.tsx`, add agent-mode detection in the `create` action: check for `X-Agent-Thread` header
- [x] 1.2 If agent mode + validation error: return JSON `{ status: "validation_error", issues, threadId }`
- [x] 1.3 If agent mode + success: create resource, return JSON `{ status: "created", data: { id, name, description, capabilities }, threadId }`
- [x] 1.4 Verify existing HTML path is untouched (no header → redirect as before)

## 2. Client intercept

- [x] 2.1 In `app/assets/route-agent-stream.tsx`, update `handleFrameFormSubmit` to inspect response content-type
- [x] 2.2 If JSON response: POST to `/route-agent/answer` with `runId`, `answer` (JSON.stringify of form result), and `toolCallId`
- [x] 2.3 If HTML response: reload frame as before (existing fallback)
- [x] 2.4 Add `X-Agent-Thread` header to the frame POST fetch if `currentThreadId` is set

## 3. Agent instructions

- [x] 3.1 In `app/actions/mastra/agents/route-agent.ts`, add instructions for form-driven workflows:
  - Navigate to form, then call `ask_user` to wait
  - Expect JSON answer containing form result
  - Report creation success or validation errors
