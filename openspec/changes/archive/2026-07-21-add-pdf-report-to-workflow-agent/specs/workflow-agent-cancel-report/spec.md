## ADDED Requirements

### Requirement: Generate action summary PDF

The workflow agent SHALL have a `generate_action_report` tool that produces a PDF document summarizing a completed user management action (cancel, lock, or unlock).

#### Scenario: Agent generates a report after completing a cancel user workflow

- **WHEN** the workflow agent completes a cancel user action (confirmation call to `cancel_user_workflow_v2`)
- **AND** the agent has called `run_consistency_checks`
- **THEN** the agent SHALL call `generate_action_report` with `actionType="cancel"`, the cancellation details, and consistency check results
- **AND** the tool SHALL return a base64-encoded PDF buffer

#### Scenario: Agent generates a report after completing a lock user workflow

- **WHEN** the workflow agent completes a lock user action (confirmation call to `lock_user_workflow_v2`)
- **AND** the agent has called `run_consistency_checks`
- **THEN** the agent SHALL call `generate_action_report` with `actionType="lock"`, the lock details, and consistency check results
- **AND** the tool SHALL return a base64-encoded PDF buffer

#### Scenario: Agent generates a report after completing an unlock user workflow

- **WHEN** the workflow agent completes an unlock user action (confirmation call to `unlock_user_workflow_v2`)
- **AND** the agent has called `run_consistency_checks`
- **THEN** the agent SHALL call `generate_action_report` with `actionType="unlock"`, the unlock details, and consistency check results
- **AND** the tool SHALL return a base64-encoded PDF buffer

#### Scenario: Cancel report contains all required fields

- **WHEN** `generate_action_report` is called with `actionType="cancel"` and valid parameters
- **THEN** the returned PDF SHALL include: target user name and email, admin name and email, cancellation timestamp, whether appointments were deleted, count of deleted appointments, and the consistency check summary (locked users with pending count, active users with pending count)

#### Scenario: Lock report shows action-specific content

- **WHEN** `generate_action_report` is called with `actionType="lock"` and valid parameters
- **THEN** the returned PDF SHALL include: target user name and email, admin name and email, lock timestamp, action description indicating login was disabled, and consistency check results
- **AND** the PDF SHALL NOT include appointment deletion information

#### Scenario: Unlock report shows action-specific content

- **WHEN** `generate_action_report` is called with `actionType="unlock"` and valid parameters
- **THEN** the returned PDF SHALL include: target user name and email, admin name and email, unlock timestamp, action description indicating login was re-enabled, and consistency check results
- **AND** the PDF SHALL NOT include appointment deletion information

#### Scenario: Report filename includes action type, user name, and date

- **WHEN** `generate_action_report` is called
- **THEN** the returned `filename` SHALL follow the pattern `<actionType>-report-<username>-<YYYY-MM-DD>.pdf`

#### Scenario: Report returns structured metadata

- **WHEN** `generate_action_report` succeeds with any valid action type
- **THEN** the result SHALL include `filename` (string), `data` (base64 string), `size` (number), and `reportType` (string matching `<actionType>-summary`)

#### Scenario: PDF uses Roboto font family

- **WHEN** `generate_action_report` generates a PDF
- **THEN** the generated PDF SHALL use the Roboto font family
