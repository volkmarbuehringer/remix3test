## ADDED Requirements

### Requirement: Customer confirms a recommended resource before slot selection

After the customer agent identifies candidate resources via `search_resources_by_capability`, it SHALL present each candidate to the customer via a structured approval before proceeding to slot selection.

#### Scenario: Customer approves the first recommended resource

- **WHEN** the agent calls `confirm_resource` with `resourceId`, `resourceName`, and `description`
- **THEN** the system SHALL suspend execution and display an approval card with the resource name and description
- **WHEN** the customer clicks "Bestätigen"
- **THEN** the system SHALL continue execution and the agent SHALL call `find_next_available_slots` with the confirmed `resourceId`

#### Scenario: Customer declines and agent presents next resource

- **WHEN** the customer clicks "Ablehnen" on the approval card
- **THEN** the system SHALL continue execution and the agent SHALL call `confirm_resource` again with the next best resource and `previousResourceIds` containing the declined IDs

#### Scenario: All candidate resources declined

- **WHEN** all resources from the `search_resources_by_capability` result have been declined
- **THEN** the agent SHALL inform the customer that no suitable resource was found

### Requirement: approve and decline actions exist

The customer chat SHALL support POST `/chat/approve` and POST `/chat/decline` endpoints that call `agent.approveToolCallGenerate()` and `agent.declineToolCallGenerate()` respectively.

#### Scenario: Approve action resumes agent

- **WHEN** a POST request is sent to `/chat/approve` with `runId`, `toolCallId`, and `threadId`
- **THEN** the system SHALL call `agent.approveToolCallGenerate({ runId, toolCallId })` and redirect to the chat page

#### Scenario: Decline action resumes agent

- **WHEN** a POST request is sent to `/chat/decline` with `runId`, `toolCallId`, and `threadId`
- **THEN** the system SHALL call `agent.declineToolCallGenerate({ runId, toolCallId })` and redirect to the chat page

### Requirement: Approval card is displayed in the customer chat

When the agent execution is suspended with a `toolApproval` flash in the session, the customer chat page SHALL render an approval card above the message input form.

#### Scenario: Approval card appears on suspension

- **WHEN** the chat page loads with `pending=true` and `approvalData` in the session
- **THEN** the system SHALL render a card showing the resource name and description, with "Bestätigen" and "Ablehnen" buttons
- **WHEN** the message input form SHALL be hidden while the approval card is displayed
