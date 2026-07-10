## ADDED Requirements

### Requirement: Chatlog route supports type query parameter

The system SHALL accept an optional `type` query parameter on `/admin/chatlog` with values `chat` or `agent`, filtering displayed conversations accordingly.

#### Scenario: GET /admin/chatlog with type=chat

- **WHEN** an admin navigates to `/admin/chatlog?type=chat`
- **THEN** the system SHALL display only conversations where NO messages contain toolCalls data

#### Scenario: GET /admin/chatlog with type=agent

- **WHEN** an admin navigates to `/admin/chatlog?type=agent`
- **THEN** the system SHALL display only conversations where SOME messages contain toolCalls data

#### Scenario: GET /admin/chatlog without type

- **WHEN** an admin navigates to `/admin/chatlog` without a `type` parameter
- **THEN** the system SHALL display all conversations (existing behavior preserved)

#### Scenario: GET /admin/chatlog with invalid type

- **WHEN** an admin navigates to `/admin/chatlog?type=invalid`
- **THEN** the system SHALL ignore the type parameter and display all conversations

### Requirement: Type filter persists across pagination

The system SHALL preserve the `type` query parameter in pagination links when navigating between pages of filtered results.

#### Scenario: Pagination preserves type filter

- **WHEN** an admin is on `/admin/chatlog?type=agent&page=1` and clicks "Next"
- **THEN** the next page link SHALL include `type=agent`

### Requirement: Admin sidebar has filtered nav entries

The admin sidebar SHALL include "Chat Only" and "Agent Only" nav items in the Data section, linking to `/admin/chatlog?type=chat` and `/admin/chatlog?type=agent` respectively.

#### Scenario: Chat Only nav link

- **WHEN** an admin clicks "Chat Only" in the sidebar
- **THEN** the system SHALL navigate to `/admin/chatlog?type=chat` within the admin frame

#### Scenario: Agent Only nav link

- **WHEN** an admin clicks "Agent Only" in the sidebar
- **THEN** the system SHALL navigate to `/admin/chatlog?type=agent` within the admin frame

### Requirement: Active type filter is displayed

The chatlog page SHALL indicate when a type filter is active and provide a link to clear it.

#### Scenario: Type filter label visible

- **WHEN** a type filter is active (`?type=chat` or `?type=agent`)
- **THEN** the page SHALL display a label indicating the active filter (e.g., "Showing: Chat conversations") with a "Clear filter" link
