## ADDED Requirements

### Requirement: Chatlog table exists in database

The system SHALL have a `chatlog` table in the PostgreSQL database with columns for `id` (TEXT PK), `conversation` (JSONB), `created_at` (BIGINT), and `updated_at` (BIGINT). The table SHALL be created during `initializeAppDatabase()` if it does not already exist.

#### Scenario: Table creation on startup
- **WHEN** `initializeAppDatabase()` is called and the `chatlog` table does not exist
- **THEN** the system SHALL create the `chatlog` table with the correct schema

#### Scenario: Table exists on startup
- **WHEN** `initializeAppDatabase()` is called and the `chatlog` table already exists
- **THEN** the system SHALL NOT attempt to recreate the table

### Requirement: Create conversation

The `createConversation()` function SHALL generate a new unique ID and insert a row into the `chatlog` table with an empty conversation array.

#### Scenario: Successful creation
- **WHEN** `createConversation()` is called
- **THEN** a new row SHALL be inserted into `chatlog` with a unique ID and `[]` as the conversation value

#### Scenario: ID collision recovery
- **WHEN** `createConversation()` encounters a primary key collision
- **THEN** it SHALL retry up to 3 times with a new ID before throwing

### Requirement: Get conversation

The `getConversation(id)` function SHALL retrieve a conversation by ID and parse the JSONB conversation field into a typed array.

#### Scenario: Existing conversation
- **WHEN** `getConversation(id)` is called with an existing ID
- **THEN** it SHALL return the full conversation row with parsed `conversation` array

#### Scenario: Non-existent conversation
- **WHEN** `getConversation(id)` is called with a non-existent ID
- **THEN** it SHALL return `null`

### Requirement: Append message to conversation

The `appendMessage(id, message)` function SHALL append a message to an existing conversation's `conversation` JSONB array using optimistic concurrency control.

#### Scenario: Successful append
- **WHEN** `appendMessage(id, message)` is called on an existing conversation
- **THEN** the message SHALL be appended to the `conversation` array and `updated_at` SHALL be updated

#### Scenario: Non-existent conversation
- **WHEN** `appendMessage(id, message)` is called with a non-existent ID
- **THEN** it SHALL return `null` and log a warning

#### Scenario: Concurrent modification
- **WHEN** two concurrent `appendMessage` calls race for the same conversation
- **THEN** the slower call SHALL detect the conflict via `jsonb_array_length` check and re-fetch the latest state

#### Scenario: Empty message rejected
- **WHEN** `appendMessage` is called with a message that has empty or whitespace-only content
- **THEN** it SHALL throw an error

### Requirement: Delete conversation

The `deleteConversation(id)` function SHALL delete a conversation row by ID.

#### Scenario: Successful deletion
- **WHEN** `deleteConversation(id)` is called with an existing ID
- **THEN** the row SHALL be deleted from the `chatlog` table

### Requirement: Chatlog schema definition

The system SHALL have a `chatlog` table definition in `app/data/schema.ts` that mirrors the database schema.

#### Scenario: Schema matches database
- **WHEN** the `chatlog` table definition is loaded
- **THEN** it SHALL define columns for `id` (text), `conversation` (json), `created_at` (bigint), and `updated_at` (bigint) with appropriate primary key configuration
