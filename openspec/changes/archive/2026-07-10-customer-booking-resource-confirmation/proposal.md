## Why

The customer booking agent (`customerAgent`) currently skips directly from resource recommendation to slot lookup without customer confirmation. This can result in showing slots for a resource the customer does not want, causing confusion and re-work. The support agent already has a `requireApproval` pattern for destructive actions (`cancel_user_account`), but the customer agent has no confirmation step for its booking flow.

## What Changes

- Add a new `confirm_resource` tool to `customerTools` with `requireApproval: true` — the agent presents a resource to the customer, who confirms or declines via a structured UI card
- Add approve/decline routes (`/chat/approve`, `/chat/decline`) to the existing chat route
- Add approve/decline actions to the customer chat controller with suspended-handling logic
- Add an approval card UI component to the customer chat page (neutral style)
- Update `customerAgent` instructions to:
  1. Call `confirm_resource` after `search_resources_by_capability`, before `find_next_available_slots`
  2. On decline: loop to the next best resource
  3. On all resources declined: inform the customer
- No changes to the slot selection or booking submission flow

## Capabilities

### New Capabilities

- `customer-resource-confirmation`: structured customer confirmation of a recommended resource before proceeding to slot selection, with decline-and-retry loop through all candidate resources

### Modified Capabilities

_(No existing specs are modified — this is a new capability entirely within the customer chat flow.)_

## Impact

- **Routes** (`app/routes.ts`): `chat: form('chat')` → `chat: route('chat', { index, action, approve, decline })`
- **Controller** (`app/actions/chat/controller.tsx`): new `approve` and `decline` actions + suspended-handling in the `action` action
- **New tool** (`app/actions/mastra/tools/customer-tools.ts`): `confirm_resource` with `requireApproval: true`
- **Agent instructions** (`app/actions/mastra/agents/customer-agent.ts`): restructured flow to include confirmation loop
- **UI** (`app/ui/customer-chat-page.tsx`): approval card component
- **Router** (`app/router.ts`): no change needed — picks up new sub-routes automatically
- **Tests** (`app/actions/chat/controller.test.ts`): new tests for approve/decline/suspended flows
