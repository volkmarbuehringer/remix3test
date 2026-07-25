**Purpose**: Before navigating to the appointments page, the workflow agent resolves the named user to ensure the filter targets the correct user's appointments.

## Requirements

### Requirement: Resolve user before appointment navigation

When the admin asks about a specific user's appointments, the workflow agent SHALL resolve the user's identity before navigating. The LLM SHALL return the user's identifying information as `targetQuery` (name, email, or numeric ID). The controller SHALL call `resolveTargetUser()` — the same function used by the user-action flow — to look up the matching user.

If the user query matches multiple users, the controller SHALL return an error message listing the ambiguous matches and stop without navigating.

If the user query matches exactly one user, the controller SHALL navigate to `/verwaltung/appointments?filter=<resolved_email>` using the user's email as the filter parameter.

#### Scenario: Admin asks about appointments for a user by name

- **WHEN** the admin sends "show appointments for John"
- **THEN** the LLM returns `{"type":"appointment","action":"check","targetQuery":"John"}`
- **AND** the controller calls `resolveTargetUser("John")`
- **AND** when exactly one user "John" is found with email "john@example.com"
- **THEN** the controller emits an SSE `navigate` event with `href: "/verwaltung/appointments?filter=john%40example.com"`

#### Scenario: Admin asks about appointments for a user by ID

- **WHEN** the admin sends "appointments for user 42"
- **THEN** the LLM returns `{"type":"appointment","action":"check","targetQuery":"42"}`
- **AND** the controller finds user with ID 42
- **THEN** the controller navigates with that user's email as filter

#### Scenario: Multiple users match the query

- **WHEN** the admin sends "show appointments for Alex" and three users named "Alex" exist
- **THEN** the controller returns an SSE `message` event: "Multiple users match \"Alex\": Alex S. (alex@…), Alex K. (alex.k@…), Alex M. (alex.m@…). Please be more specific."
- **AND** no navigation occurs
