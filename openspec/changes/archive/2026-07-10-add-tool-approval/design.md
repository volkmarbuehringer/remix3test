## Overview

This change adds a hard approval gate for the `cancel_user_account` tool in the support agent. When the agent requests this tool, execution suspends and the chat UI shows an approval card with Approve/Decline buttons. No streaming refactor is needed — `generate()` with `requireToolApproval: true` returns `finishReason === 'suspended'`, and `approveToolCallGenerate()` resumes execution.

## Flow

```
Admin sends "cancel user 5"
         │
         ▼
  agent.generate("cancel user 5", { requireToolApproval: true })
         │
         ├── finishReason === 'suspended'
         │     suspendPayload = { toolCallId, args: { targetUserId: 5 } }
         │     result.text = "Soll ich Benutzer foo (ID 5) löschen?"
         │
         │   Controller:
         │     · Stores { runId, toolCallId, prompt } in session flash
         │     · Redirects to /mastra/chat
         │     · ChatPage renders approval card:
         │       ┌──────────────────────────────────────┐
         │       │  Benutzerkonto löschen?              │
         │       │  Account von foo (foo@email.com)     │
         │       │  wird dauerhaft deaktiviert.         │
         │       │                                      │
         │       │  [✔ Bestätigen]  [✖ Ablehnen]       │
         │       └──────────────────────────────────────┘
         │
         ├── Admin clicks "Bestätigen"
         │     POST /mastra/chat/approve { runId, toolCallId }
         │     agent.approveToolCallGenerate({ runId, toolCallId })
         │       → tool executes → agent continues → final response
         │     Redirect to /mastra/chat with final text
         │
         └── Admin clicks "Ablehnen"
               POST /mastra/chat/decline { runId, toolCallId }
               agent.declineToolCall({ runId, toolCallId })
                 → agent informed tool was declined → explains to admin
               Redirect to /mastra/chat with decline text
```

## Route Design

Current: `form('chat')` → index (GET) + action (POST)

New routes in `routes.ts`:

```
mastra: route('mastra', {
  chat: route('chat', {
    index: get('/'),
    action: post('/', { requireToolApproval: true }),
    approve: post('/approve'),
    decline: post('/decline'),
  }),
})
```

The `form()` helper is replaced with explicit `route()` to allow sub-routes.

## Controller Design

Three action handlers in `app/actions/mastra/controller.tsx`:

### `action` (POST /mastra/chat)

- Same validation, rate limiting, auth as today
- Passes `requireToolApproval: true` to `agent.generate()`
- On `finishReason === 'suspended'`:
  - Store `{ runId, toolCallId }` in session flash
  - Redirect to `/mastra/chat` with `pending=true` query param
  - Chat page reads flash data, renders approval card
- On normal completion: same redirect/JSON as today

### `approve` (POST /mastra/chat/approve)

- Validates `runId` + `toolCallId` from form data
- Calls `agent.approveToolCallGenerate({ runId, toolCallId })`
- Redirects to `/mastra/chat` with final response text

### `decline` (POST /mastra/chat/decline)

- Validates `runId` + `toolCallId` from form data
- Calls `agent.declineToolCall({ runId, toolCallId })`
- Redirects to `/mastra/chat` with decline confirmation

## Tool Changes

In `app/actions/mastra/tools/support-tools.ts`, add to `cancel_user_account`:

```typescript
cancelUserAccount: createTool({
  id: 'cancel_user_account',
  // ... existing config ...
  requireApproval: true,
  execute: async ({ targetUserId }) => {
    // ... existing implementation ...
  },
})
```

## UI: Approval Card

New component added to `MastraChatPage` (or as a sub-component) rendered when:

1. URL has `?pending=true`
2. Session flash has `{ runId, toolCallId, prompt }`

The card shows:

- Warning text about the destructive action
- Target user info (from `suspendPayload.args`)
- Approve button → POSTs to `/mastra/chat/approve`
- Decline button → POSTs to `/mastra/chat/decline`

## Session Flash Storage

No DB changes. Suspension state lives in the Remix session flash:

```typescript
// On suspension:
session.flash('toolApproval', { runId, toolCallId })

// On page render:
let pending = session.get('toolApproval')
```

Flash data survives exactly one redirect — perfect for this flow.

## Security

- `requireApproval: true` is a hard gate — the tool's `execute` function never runs without explicit approval
- `runId` and `toolCallId` are stored server-side in session flash, never exposed in URLs
- The approve/decline endpoints require the same admin auth middleware as the chat itself
- The `cancel_user_account` tool's `requireAdminId()` check still fires inside `execute` after approval

## Edge Cases

- **Timeout during suspension**: The 60s `AGENT_TIMEOUT_MS` could fire while waiting. Solution: skip the abort timeout when `requireToolApproval` is active, or use a longer timeout.
- **Page refresh**: If the admin refreshes the page, flash data is lost. The pending card disappears and the admin needs to re-ask. Acceptable — no dangling run.
- **Multiple concurrent approvals**: Only one suspension per thread at a time. The controller creates/routes on a single `threadId`. `approveToolCallGenerate` resolves the specific `runId`.
- **Decline → agent continues**: After decline, the agent's next response explains the cancellation was not approved. The same thread continues naturally.
