# Tool Approval

## Scope

Hard approval gate for `cancel_user_account` tool in the support agent chat.

## Requirements

### R1: Tool-level approval enforcement

- `cancel_user_account` tool must have `requireApproval: true`
- The tool's `execute` function must never run unless explicitly approved via `agent.approveToolCallGenerate()`

### R2: Generate call suspension

- `agent.generate()` must be called with `requireToolApproval: true`
- When a `requireApproval` tool is requested, `generate()` must return `finishReason === 'suspended'`
- The return value must include `suspendPayload` with `toolCallId` and the tool arguments
- The agent's text output before suspension (the explanation/question) must be accessible

### R3: Session flash storage

- Suspension state (`runId`, `toolCallId`) must be stored in Remix session flash
- Flash data must survive exactly one redirect
- On page refresh (flash consumed or expired), the pending state must gracefully disappear

### R4: Approval endpoints

- `POST /mastra/chat/approve` must accept `runId` and `toolCallId`
- `POST /mastra/chat/decline` must accept `runId` and `toolCallId`
- Both endpoints must require the same auth middleware as the main chat
- `approveToolCallGenerate()` resumes the agent and returns the final response
- `declineToolCall()` resumes the agent and returns the decline response

### R5: Approval card UI

- When a suspension is active, `MastraChatPage` must render an approval card
- The card must show a warning about the destructive action
- The card must show the target user information
- The card must have Approve and Decline buttons
- Both buttons must POST to the respective endpoints with the suspension data
- After approval/decline, the card is replaced by the agent's final response

### R6: Timeout handling

- The 60s abort timeout must not fire during suspension
- When `requireToolApproval` is active, the abort timeout must be skipped or extended

## Non-requirements

- Other tools do not need approval (this is scoped to `cancel_user_account` only)
- No database changes for suspension state
- No streaming API changes — the existing `generate()` flow is preserved
- No changes to the customer agent or booking workflows
