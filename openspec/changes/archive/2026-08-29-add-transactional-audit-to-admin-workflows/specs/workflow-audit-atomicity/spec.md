# Workflow Audit Atomicity

## Purpose

Ensures that destructive Mastra workflow mutations (cancel user, lock user, unlock user, delete user appointments) can never exist without their audit trail: the audit-log entry is committed atomically with the mutation it describes, and an audit failure prevents the mutation.

## ADDED Requirements

### Requirement: Mutation and audit entry are committed atomically

The destructive user-management and appointment-deletion workflows SHALL commit their audit-log entry in the same database transaction as the mutation it describes, such that either both or neither become visible in the database.

#### Scenario: Crash between mutation and audit write

- **WHEN** the process crashes after the mutation statements execute but before the transaction commits
- **THEN** neither the mutation nor the audit entry SHALL be visible in the database after restart
- **AND** a retry SHALL apply the mutation and its audit entry together

#### Scenario: Audit write failure fails the action

- **WHEN** the audit-log INSERT fails while the mutation transaction is open
- **THEN** the entire transaction SHALL roll back
- **AND** the workflow SHALL report failure with an error
- **AND** no part of the mutation SHALL be visible in the database

#### Scenario: Successful action produces both mutation and audit entry

- **WHEN** a destructive workflow completes with success reported to the admin
- **THEN** an audit entry describing the action SHALL exist in the audit log with the same actor, target, and action details
- **AND** the reported `auditLogged` flag SHALL be true

### Requirement: No audit entry without a state change

The workflows SHALL NOT write an audit entry when the mutation applied no state change.

#### Scenario: Already-locked user

- **WHEN** a lock action targets a user who is already locked and no row is updated
- **THEN** the workflow SHALL succeed as an idempotent no-op
- **AND** SHALL NOT write an audit entry

#### Scenario: Already-unlocked user

- **WHEN** an unlock action targets a user who is already unlocked and no row is updated
- **THEN** the workflow SHALL succeed as an idempotent no-op
- **AND** SHALL NOT write an audit entry
