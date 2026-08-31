## ADDED Requirements

### Requirement: Support agent toolset is read-only for account mutations
The support agent SHALL NOT expose any tool that mutates user accounts. Its toolset SHALL be read-only with respect to accounts: it MAY look up users, appointments, resources, offerings, and messages and generate PDF reports, but MUST NOT cancel, lock, or unlock a user account. Account mutations SHALL be performed only through the agent-events pipeline.

#### Scenario: Admin requests an account mutation in support chat
- **WHEN** an admin asks the support agent to cancel, lock, or unlock a user account
- **THEN** the support agent SHALL NOT invoke a mutation tool
- **AND** it SHALL either decline the mutation or redirect the admin to the agent-events pipeline for the account mutation

#### Scenario: Support agent still answers read-only queries
- **WHEN** an admin asks the support agent to look up a user, list appointments, or generate a report
- **THEN** the support agent SHALL continue to answer using its read-only Q&A tools

## REMOVED Requirements

### Requirement: Lock user account
**Reason**: The support agent no longer owns account mutations. Locking is performed only via the audited agent-events pipeline (`lockUserWorkflow` → `userManagementWorkflow` with `action=lock`) under a durable, resumable confirmation gate, which also writes an audit entry.
**Migration**: Use the Agent-Events pipeline (/agent-events) to lock a user account instead of the support agent.

### Requirement: Unlock user account
**Reason**: The support agent no longer owns account mutations. Unlocking is performed only via the audited agent-events pipeline (`unlockUserWorkflow` → `userManagementWorkflow` with `action=unlock`) under a durable, resumable confirmation gate, which also writes an audit entry and invalidates sessions.
**Migration**: Use the Agent-Events pipeline (/agent-events) to unlock a user account instead of the support agent.
