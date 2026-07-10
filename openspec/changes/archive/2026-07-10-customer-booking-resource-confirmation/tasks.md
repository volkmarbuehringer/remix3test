## 1. Routes

- [x] 1.1 Change `chat: form('chat')` to `chat: route('chat', { index: get('/'), action: post('/'), approve: post('/approve'), decline: post('/decline') })` in `app/routes.ts`

## 2. New Tool: confirm_resource

- [x] 2.1 Add `confirmResource` tool to `app/actions/mastra/tools/customer-tools.ts` with `requireApproval: true`, inputs `resourceId`, `resourceName`, `description`, `previousResourceIds`, and a no-op `execute` returning `{ success: true, resourceId, resourceName }`

## 3. Controller: Suspended Handling & Approve/Decline Actions

- [x] 3.1 Add suspended-handling in `app/actions/chat/controller.tsx` `action` action: check `result.finishReason === 'suspended'`, read `suspendPayload`, flash `toolApproval` to session, redirect with `pending=true`
- [x] 3.2 Add `approve` action: read `runId`, `toolCallId`, `threadId` from formData, call `agent.approveToolCallGenerate({ runId, toolCallId })`, redirect back to chat
- [x] 3.3 Add `decline` action: read `runId`, `toolCallId`, `threadId` from formData, call `agent.declineToolCallGenerate({ runId, toolCallId })`, redirect back to chat
- [x] 3.4 Wire new sub-routes in controller type (update `createController<typeof routes.chat>` — it already works if the route matches)

## 4. UI: Approval Card

- [x] 4.1 Add `approvalData` prop to `CustomerChatPageProps` in `app/ui/customer-chat-page.tsx`
- [x] 4.2 Add approval card component (neutral style, resource name + description, approve/decline forms posting to `/chat/approve` and `/chat/decline`)
- [x] 4.3 Hide the message input form when approval card is shown (mirror the support chat pattern)

## 5. Agent Instructions

- [x] 5.1 Update `customerAgent` instructions in `app/actions/mastra/agents/customer-agent.ts`: after resource search, call `confirm_resource` first; on decline → next resource; on all declined → no suitable resource; on approval → call `find_next_available_slots`

## 6. Validation & Tests

- [x] 6.1 Run full typecheck
- [x] 6.2 Run all existing tests to confirm no regressions
