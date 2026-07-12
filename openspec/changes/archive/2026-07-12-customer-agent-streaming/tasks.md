## 1. Routes

- [x] 1.1 Add `stream: get('/stream/:runId')` to the chat route in `app/routes.ts`
- [x] 1.2 Add `answer: post('/answer')` to the chat route in `app/routes.ts`

## 2. Controller — Streaming Core

- [x] 2.1 Replace `agent.generate()` with `agent.stream()` in the chat `action` handler
- [x] 2.2 Store stream via `setStream(output.runId, stream)` in the action handler
- [x] 2.3 Return JSON `{ runId, threadId }` from the action handler (no redirect)
- [x] 2.4 Add `stream` action serving SSE from `getStream(runId)`, mirroring test agent's SSE event forwarding

## 3. Controller — Approve / Decline / Answer

- [x] 3.1 Rewrite `approve` action to return JSON with `requiresApproval` or `runId` (no redirect)
- [x] 3.2 Rewrite `decline` action to return JSON with `requiresApproval` or `runId` (no redirect)
- [x] 3.3 Add `answer` action calling `agent.resumeStream()` mirroring test agent pattern
- [x] 3.4 Remove all session flash writes (`toolApproval`, `pendingBooking`, `bookingResult`, `postBookingDecision`) from all controller actions
- [x] 3.5 Remove the `confirm_booking` form action handler entirely

## 4. Agent & Tools

- [x] 4.1 Add `askUserTool` to the customer agent's `tools` object in `customer-agent.ts`
- [x] 4.2 Update agent instructions to describe `askUserTool` usage for resource selection, slot-fallback, and post-booking questions
- [x] 4.3 Remove `requireApproval: true` from `confirm_resource` tool in `customer-tools.ts`
- [x] 4.4 Remove `confirm_resource` tool entirely if no longer needed (agent uses `askUserTool` instead)

## 5. Client Entry

- [x] 5.1 Create `app/assets/customer-chat-stream.tsx` clientEntry component
- [x] 5.2 Implement SSE connection: POST action → open EventSource to `/chat/stream/:runId`
- [x] 5.3 Implement text-delta rendering (append to assistant message bubble)
- [x] 5.4 Implement tool-call card rendering (collapsible, shows tool name + args)
- [x] 5.5 Implement tool-result rendering (below tool card, with slot buttons for slot results)
- [x] 5.6 Implement tool-call-approval rendering (approve/decline buttons for cancel tools)
- [x] 5.7 Implement question card rendering (radio button or free-text for askUserTool)
- [x] 5.8 Implement approve/decline/answer POST flow and stream reconnection
- [x] 5.9 Implement slot button click → send chat message with slot details
- [x] 5.10 Implement reasoning display (reasoning-start/delta/end events)
- [x] 5.11 Handle stream error and complete events (re-enable form, clean up)

## 6. UI Page

- [x] 6.1 Strip `customer-chat-page.tsx` to static shell (remove booking form, approval cards, post-booking card, pendingBooking rendering)
- [x] 6.2 Add `<CustomerChatStream />` component to the page
- [x] 6.3 Remove session-based state from page props (`pendingBooking`, `bookingResult`, `postBookingDecision`, `approvalData`)
- [x] 6.4 Remove `__setTestCustomerAgent` and test injection from controller (streams can't be mocked the same way)

## 7. Router

- [x] 7.1 Import and wire new stream and answer actions in `app/router.ts` (if needed — `createController` handles sub-routes automatically)

## 8. Tests

- [x] 8.1 Rewrite `app/actions/chat/controller.test.ts` for streaming flow
- [x] 8.2 Test action returns JSON `{ runId, threadId }` for valid message
- [x] 8.3 Test stream endpoint returns SSE headers and events
- [x] 8.4 Test approve/decline return JSON responses
- [x] 8.5 Test answer action resumes agent and returns runId
- [x] 8.6 Test validation errors return 400 JSON
- [x] 8.7 Test rate limiting returns 429
- [x] 8.8 Test that tool-call-approval events appear in stream for cancel tools
- [x] 8.9 Test question card events appear in stream when agent uses askUserTool
