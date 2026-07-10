## ADDED Requirements

### Requirement: Chat endpoint

The `/mastra/chat` route SHALL accept a user message and return an assistant response using the Mastra Agent with Memory.

#### Scenario: Send a message and receive response

- **WHEN** a POST request with a valid `message` field is sent to `/mastra/chat`
- **THEN** the system SHALL return a JSON response with the assistant's `response` text

#### Scenario: Message validation

- **WHEN** a POST request with an empty or missing `message` field is sent
- **THEN** the system SHALL return a 400 error with an appropriate error message

#### Scenario: Message length limit

- **WHEN** a message exceeds 5000 characters
- **THEN** the system SHALL return a 400 error

#### Scenario: Rate limiting

- **WHEN** a user sends more than one request within 2 seconds
- **THEN** the system SHALL return a 429 error

### Requirement: Conversation memory

The chat endpoint SHALL persist conversation history using Mastra Memory backed by PostgresStore. Each conversation thread is scoped to a user (resource). The `threadId` SHALL be accepted from the request (form field or query param) for conversation continuity, or auto-generated for new conversations.

#### Scenario: New conversation creates thread

- **WHEN** a user sends a message without a `threadId`
- **THEN** Mastra Memory SHALL create a new thread and persist both the user message and the assistant response, and return the new `threadId` in the response

#### Scenario: Existing conversation continues thread

- **WHEN** a user sends a message with an existing `threadId` (via form field or query param)
- **THEN** Mastra Memory SHALL append the user message and assistant response to the existing thread

#### Scenario: Thread is scoped to user

- **WHEN** a message is processed with `resource: user.id`
- **THEN** the thread SHALL be associated with that resource, isolating conversations between users

### Requirement: Agent behavior

The agent SHALL use the support tools to answer admin queries about users, appointments, and system data. It SHALL NOT generate, modify, or delete data.

#### Scenario: User lookup via tools

- **WHEN** an admin asks "find user with email X" or "look up user ID 5"
- **THEN** the agent SHALL call the `lookup_user` tool and return the result

#### Scenario: Appointment listing

- **WHEN** an admin asks "show recent appointments" or "appointments for user X"
- **THEN** the agent SHALL call the `list_recent_appointments` tool and return the result

#### Scenario: User count

- **WHEN** an admin asks "how many users" or "count admins"
- **THEN** the agent SHALL call the `count_users` tool and return the result

#### Scenario: Data mutation is refused

- **WHEN** an admin asks to create, update, or delete data
- **THEN** the agent SHALL refuse and explain it is read-only

### Requirement: Scorers

Every agent run SHALL be scored for completeness. Scores SHALL be persisted via `PostgresStore`.

#### Scenario: Completeness scored

- **WHEN** the agent completes a response
- **THEN** a `completeness` score SHALL be computed and stored

### Requirement: Authentication + Authorization

The `/mastra/chat` route SHALL require authentication AND admin role. Only admin users can access it (tools expose all users' data).

#### Scenario: Unauthenticated request

- **WHEN** an unauthenticated request is sent to `/mastra/chat`
- **THEN** the system SHALL return a 302 redirect to login

#### Scenario: Non-admin user is rejected

- **WHEN** a non-admin authenticated user sends a request
- **THEN** the system SHALL return a 403 forbidden response

#### Scenario: Admin request succeeds

- **WHEN** an admin user sends a request
- **THEN** the system SHALL process the message and return a response
