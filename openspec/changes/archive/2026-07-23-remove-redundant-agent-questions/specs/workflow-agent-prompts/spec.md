## ADDED Requirements

### Requirement: Workflow agent executes user actions without redundant confirmation

When an admin explicitly states an action (lock/cancel/unlock a user), the workflow agent SHALL execute the action without asking "What would you like to do?" or "Confirm?" in the chat. The admin's stated intent SHALL be treated as the confirmation. System-level `requireApproval` on the tool SHALL remain the sole confirmation gate.

#### Scenario: Admin states exact action for lock
- **WHEN** admin says "Lock user 5"
- **THEN** agent calls lock_user_workflow_v2 with targetUserId=5 and confirmed=false to lookup and navigate
- **AND** agent navigates to the user page
- **AND** agent calls lock_user_workflow_v2 with targetUserId=5 and confirmed=true to execute
- **AND** agent does NOT call ask_user for confirmation in the chat

#### Scenario: Admin states exact action for unlock
- **WHEN** admin says "Unlock user 5"
- **THEN** agent calls unlock_user_workflow_v2 with targetUserId=5 and confirmed=false to lookup and navigate
- **AND** agent navigates to the user page
- **AND** agent calls unlock_user_workflow_v2 with targetUserId=5 and confirmed=true to execute
- **AND** agent does NOT call ask_user for confirmation in the chat

#### Scenario: Admin states exact action for cancel
- **WHEN** admin says "Cancel user 5"
- **THEN** agent calls cancel_user_workflow_v2 with targetUserId=5 and confirmed=false to lookup and navigate
- **AND** agent navigates to the user page
- **AND** agent calls check_pending_appointments for the user
- **AND** if appointments exist, agent calls ask_user("Delete {count} pending appointments?") with options ["Delete", "Keep"]
- **AND** agent calls cancel_user_workflow_v2 with targetUserId=5, confirmed=true, and the admin's deletion choice
- **AND** agent does NOT call ask_user asking "What would you like to do?" or "Confirm?"

### Requirement: Admin browsing without action intent does not trigger action

When an admin navigates to the user list without requesting a specific action (e.g., "Show me locked users"), the workflow agent SHALL navigate and stop. It SHALL NOT ask "What would you like to do?" or suggest actions via ask_user.

#### Scenario: Admin browses users without action intent
- **WHEN** admin says "Show me locked users"
- **THEN** agent navigates to /admin/users with filter=disabled
- **AND** agent ends response without calling ask_user

### Requirement: Workflow agent does not ask "Anything else?" at end of protocol

After completing a user management protocol (lock/cancel/unlock → consistency checks → report), the workflow agent SHALL end its response with the final results. It SHALL NOT ask "Is there anything else?", "Any other questions?", or similar closing prompts.

#### Scenario: Agent completes lock protocol
- **WHEN** agent finishes lock protocol including consistency checks and report
- **THEN** agent presents results
- **AND** agent does NOT ask follow-up questions like "Anything else?"

### Requirement: Workflow agent reliably carries targetUserId between tool calls

The workflow agent SHALL carry the targetUserId from the lookup call to the execute call without re-asking the admin. If the agent cannot determine the targetUserId for the execute call, it SHALL use the tool's working memory or async storage rather than asking the admin again.

#### Scenario: Agent executes confirmed action without re-asking for userId
- **WHEN** agent has called cancel_user_workflow_v2 with targetUserId=5 (confirmed=false)
- **AND** admin has responded to the appointment deletion question
- **THEN** agent calls cancel_user_workflow_v2 with targetUserId=5 (confirmed=true) using the same userId from context
- **AND** agent does NOT ask admin "What was the user ID again?"
