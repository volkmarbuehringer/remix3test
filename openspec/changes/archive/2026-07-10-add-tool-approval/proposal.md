## Why

`cancel_user_account` is the only destructive mutation in the support agent. Currently it's gated by LLM instructions only ("confirm with admin before calling"). This is a soft gate — prompt injection or a confused agent could bypass it. Adding `requireApproval: true` makes it a hard gate: the tool can't execute without explicit admin approval via the UI.

## What Changes

- **New** `requireApproval: true` on `cancel_user_account` tool
- **New** `/mastra/chat/approve` and `/mastra/chat/decline` POST routes
- **New** approval card UI rendered in `MastraChatPage` when a tool call is suspended
- **New** session flash storage for suspension state (`runId`, `toolCallId`)
- **Modified** `callAgentWithTimeout` to pass `requireToolApproval: true` and detect `finishReason === 'suspended'`
- **Modified** chat controller `action` handler to return suspension state instead of response
- **Modified** support agent tools — `cancel_user_account` gets `requireApproval: true`

## Capabilities

### New Capabilities

- `tool-approval`: Hard gate on `cancel_user_account` requiring explicit admin Approve/Decline in the chat UI

### Modified Capabilities

- `mastra-chat`: Controller and UI updated to handle the suspended state and approval flow

## Impact

- **Routes**: `POST /mastra/chat/approve` and `POST /mastra/chat/decline` added to `routes.ts`
- **New files**: `app/actions/mastra/approval-schema.ts` (form data validation)
- **Modified files**:
  - `app/actions/mastra/controller.tsx` — split action into message, approve, decline handlers
  - `app/actions/mastra/shared-agent.ts` — update `CallAgentOptions` type, add `requireToolApproval`
  - `app/actions/mastra/tools/support-tools.ts` — add `requireApproval: true` to `cancel_user_account`
  - `app/ui/admin-mastra-chat-page.tsx` — approval card component when suspended
  - `app/routes.ts` — add approve/decline routes
- **Database**: None (suspension data stored in session flash only)
- **Breaking change**: None — existing chat flow unchanged for non-suspended responses
