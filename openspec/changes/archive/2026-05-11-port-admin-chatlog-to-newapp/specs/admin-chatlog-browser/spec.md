## ADDED Requirements

### Requirement: Chatlog browser lists conversations

The system SHALL serve an HTML page at `/admin/chatlog` that displays a paginated list of chat/agent conversations with metadata (creation date, message count, type badge).

#### Scenario: GET /admin/chatlog by admin user

- **WHEN** an admin user navigates to `/admin/chatlog`
- **THEN** the system SHALL render a page listing conversations, paginated at 5 per page, with each item showing ID, type badge (Chat/Agent), timestamps, and message count

#### Scenario: GET /admin/chatlog without conversations

- **WHEN** no conversations exist in the chatlog table
- **THEN** the system SHALL display an empty state message "No conversations yet."

### Requirement: Chatlog browser supports text search filtering

The system SHALL provide a filter input that searches conversation content using ILIKE on the JSONB field.

#### Scenario: Filter by keyword

- **WHEN** an admin submits a filter query via the search form
- **THEN** the system SHALL return conversations whose message content contains the keyword (case-insensitive)

#### Scenario: Clear filter

- **WHEN** a filter is active and the user clicks "Clear filter"
- **THEN** the system SHALL return all conversations without filtering

#### Scenario: Filter with long input

- **WHEN** a filter query exceeds 200 characters
- **THEN** the system SHALL truncate the query to 200 characters before searching

### Requirement: Chatlog browser supports pagination

The system SHALL paginate conversation results with Previous/Next links, detecting whether more results exist by fetching `PAGE_SIZE + 1` items.

#### Scenario: Navigate to next page

- **WHEN** there are more conversations than the current page displays
- **THEN** a "Next" link SHALL be shown that loads the next page of results

#### Scenario: Navigate to previous page

- **WHEN** the current page is greater than 1
- **THEN** a "Previous" link SHALL be shown that loads the previous page

#### Scenario: No next page

- **WHEN** the current page has fewer than PAGE_SIZE results
- **THEN** a disabled "Next" indicator SHALL be shown

### Requirement: Chatlog browser displays conversation details

The system SHALL provide expandable details for each conversation, showing individual messages with role labels, timestamps, elapsed time, token counts, and tool call metadata where present.

#### Scenario: Expand message details

- **WHEN** a user clicks on the "View N message(s)" summary for a conversation
- **THEN** the system SHALL expand to show each message with its role (User/Assistant), timestamp, elapsed time, token count, and content

#### Scenario: Tool call metadata displayed

- **WHEN** a message has toolCalls data
- **THEN** the system SHALL display a tool details section showing each tool name, its input parameters, and its results

#### Scenario: Agent vs Chat type badge

- **WHEN** a conversation has messages with toolCalls
- **THEN** the conversation SHALL display an "Agent" badge (purple) instead of a "Chat" badge (blue)

### Requirement: Chatlog browser supports conversation deletion

The system SHALL accept POST requests to `/admin/chatlog/:id/delete` to delete a conversation, with a confirmation dialog before deletion.

#### Scenario: Delete conversation

- **WHEN** an admin clicks the Delete button on a conversation and confirms
- **THEN** the system SHALL delete the conversation from the chatlog table and redirect to the chatlog index page

#### Scenario: Cancel deletion

- **WHEN** an admin clicks the Delete button and cancels the confirmation dialog
- **THEN** the system SHALL NOT delete the conversation
