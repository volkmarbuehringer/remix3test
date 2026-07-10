## Purpose

Defines a customer-facing Mastra agent that accepts natural-language problem descriptions, searches resource capabilities, and recommends the best-fitting resource. Accessible by any authenticated (non-admin) user via `/chat`. The agent explicitly does NOT create, modify, or delete data.

## Requirements

### Requirement: Customer agent SHALL search resources by capability

The customer agent SHALL have a tool `searchResourcesByCapability` that accepts a free-text query and returns resources whose `capabilities` field matches via ILIKE/trigram search. Results SHALL include the resource id, name, description, and a capabilities snippet.

#### Scenario: Tool returns matching resources

- **WHEN** customer agent calls `searchResourcesByCapability` with query "ruhiger Raum für Therapie"
- **THEN** the tool returns all resources whose capabilities match the query terms
- **AND** each result includes id, name, description, and capabilities

#### Scenario: Tool returns empty list for no matches

- **WHEN** customer agent calls `searchResourcesByCapability` with a query matching no resource capabilities
- **THEN** the tool returns an empty list

### Requirement: Customer agent SHALL recommend best resource

The customer agent SHALL analyze the returned results and recommend the resource that best matches the customer's described problem. If multiple resources match, the agent SHALL rank them by relevance and present the top choice with reasoning. If no resources match, the agent SHALL clearly state that no suitable resource was found.

#### Scenario: Agent recommends a matching resource

- **WHEN** customer describes a problem that matches a resource's capabilities
- **THEN** the agent responds with the resource name, a brief explanation of why it fits, and a summary of relevant capabilities

#### Scenario: Agent handles no match gracefully

- **WHEN** customer describes a problem matching no resource capabilities
- **THEN** the agent responds that no suitable resource was found
- **AND** asks the customer to refine their description or contact an admin

### Requirement: Customer agent SHALL be read-only

The customer agent instructions SHALL explicitly forbid creating, modifying, or deleting any data in the system. The agent SHALL only use the `searchResourcesByCapability` tool (plus `getCurrentDateTime` and `getLocationContext` for context). No appointment booking, user creation, or data mutation tools SHALL be available.

#### Scenario: Agent refuses booking request

- **WHEN** customer asks the agent to book an appointment
- **THEN** the agent responds that it cannot book appointments
- **AND** suggests the customer use the appointment booking page instead

### Requirement: Customer chat SHALL be accessible at `/chat`

A new route `/chat` SHALL be available for authenticated users. The route SHALL NOT require admin privileges. Unauthenticated visitors SHALL be redirected to the login page.

#### Scenario: Authenticated user can access chat

- **WHEN** a logged-in (non-admin) user visits `/chat`
- **THEN** the chat page renders with the customer agent UI

#### Scenario: Unauthenticated user is redirected

- **WHEN** an unauthenticated visitor visits `/chat`
- **THEN** they are redirected to the login page with a returnTo parameter pointing to `/chat`

### Requirement: Customer chat SHALL support conversation threads

The chat SHALL use Mastra memory for thread persistence, creating a new thread ID on first message and continuing the same thread on subsequent messages in the same session. Thread ID SHALL be passed as a URL parameter.

#### Scenario: First message creates a new thread

- **WHEN** customer sends a message without a threadId parameter
- **THEN** a new thread is created with a UUID
- **AND** the response redirects to `/chat?threadId=<new-uuid>`

#### Scenario: Subsequent messages continue the thread

- **WHEN** customer sends a message with an existing threadId
- **THEN** the agent generates a response in the context of the conversation history
