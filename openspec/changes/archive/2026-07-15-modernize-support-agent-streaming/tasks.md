## 1. Routes and Router

- [x] 1.1 Add `/mastra/chat/toolDecision` (POST) and `/mastra/chat/answer` (POST) routes to `app/routes.ts`
- [x] 1.2 Update `app/router.ts` to map new routes to the support agent controller

## 2. Shared Infrastructure

- [x] 2.1 Extract `pipeStream()` and `filterAndForward()` from `app/actions/route-agent/controller.tsx` into a shared utility (e.g., `app/utils/agent-sse.ts`) so both agents use the same SSE pipe code
- [x] 2.2 Update `TestAgent` interface in `app/actions/mastra/shared-agent.ts` to include `stream()` and `resumeStream()` methods

## 3. Controller Rewrite

- [x] 3.1 Rewrite `action` handler in `app/actions/mastra/controller.tsx` to use `agent.stream()` with direct-pipe SSE response, wrapped in `runWithAdminId()`
- [x] 3.2 Add `toolDecision` handler that proxies to `agent.approveToolCallGenerate()` / `agent.declineToolCallGenerate()` and pipes the resulting stream back
- [x] 3.3 Add `answer` handler that calls `agent.resumeStream()` and pipes the stream back
- [x] 3.4 Remove `approve` and `decline` handlers
- [x] 3.5 Remove `wantsJson()` dual-mode branching from `action` handler
- [x] 3.6 Remove `callAgentWithTimeout()` from `app/actions/mastra/shared-agent.ts`
- [x] 3.7 Preserve per-user rate limiting (using `chatRateLimiter.attempt(user.id)`)
- [x] 3.8 Preserve audit logging (`logAdminAction` on completion)
- [x] 3.9 Preserve abort timeout via `AbortSignal` passed to `agent.stream()`

## 4. Agent Updates

- [x] 4.1 Add `ask_user` tool to `app/actions/mastra/agents/support-agent.ts`
- [x] 4.2 Update support agent instructions to describe when to use `ask_user` (ambiguous queries, multiple matches)

## 5. Frontend: Frame Page Layout

- [x] 5.1 Create `app/ui/support-agent-page.tsx` with Frame-based layout matching `route-agent-page.tsx` structure:
  - `Frame` for chat history content
  - Agent bar (`#agent-bar`) for streaming text, questions, approvals
  - Input bar with text input and submit button
- [x] 5.2 Update `index` handler in `app/actions/mastra/controller.tsx` to render the new page (optional second `Frame` for agent-driven admin page display)

## 6. Frontend: Streaming Client Component

- [x] 6.1 Create `app/assets/support-agent-stream.tsx` with `clientEntry()` component consuming SSE events:
  - `event: message` → append text to agent bar
  - `event: suspension` → render approve/decline buttons (prominent red styling for `cancel_user_account` tool)
  - `event: question` → render radio/checkbox/free-text question UI
  - `event: navigate` → update frame src (optional, passive — only if tool result includes route data)
  - `event: complete` → reload chat history frame, reset bar
  - `event: agent-error` → show error in bar
  - POST `/answer` for question responses
  - POST `/toolDecision` for approve/decline actions

## 7. Testing

- [x] 7.1 Update controller tests for SSE streaming response
- [ ] 7.2 Add test for tool approval via `/toolDecision` endpoint
- [ ] 7.3 Add test for ask_user question via `/answer` endpoint
- [x] 7.4 Verify `runWithAdminId` context injection during streaming
- [x] 7.5 Run typecheck and lint

## 8. Cleanup

- [ ] 8.1 Remove `app/ui/admin-mastra-chat-page.tsx` after verifying new page works
- [x] 8.2 Remove `callAgentWithTimeout()` from shared-agent.ts
- [x] 8.3 Remove unused session-flash tool approval code from controller
