## Why

The workflow agent asks redundant questions that slow down admin operators: re-asking intent when already stated, confirming actions when the user already confirmed by typing them, and asking "anything else?" at the end when the conversation should continue naturally. Each action requires up to 6 user touchpoints when 2-3 would suffice.

## What Changes

- Remove the redundant "What would you like to do?" ask_user step when the admin has already stated their action intent
- Remove the redundant "Confirm?" ask_user step in cancel/lock/unlock protocols — the user's original statement IS the confirmation
- Remove end-of-flow "Anything else?" questions — the agent ends silently and trusts the user to type their next request
- Preserve the one genuine decision point for cancellation: whether to delete pending appointments
- Preserve system-level `requireApproval` buttons as the security gate
- Ensure `targetUserId` is reliably carried forward between tool calls so the agent never re-asks for it

## Capabilities

### New Capabilities
- `workflow-agent-prompts`: Streamlined instruction set for the workflow agent covering cancel/lock/unlock flows without redundant confirmation steps

### Modified Capabilities

None — this changes agent instructions and tool behavior, not spec-level requirements.

## Impact

- **`app/actions/mastra/agents/workflow-agent.ts`**: Instruction rewrite for lock/cancel/unlock protocols, removal of redundant ask_user steps, stronger anti-loop language
- **`app/actions/mastra/agents/customer-agent.ts`**: Optional — consider whether "Möchten Sie einen weiteren Termin buchen?" should also be softened
- **Optional tool change**: If the `targetUserId` fragility is addressed via async storage or workingMemory, the tool definitions in `workflow-agent.ts` would also change
- No database, API, or route changes
