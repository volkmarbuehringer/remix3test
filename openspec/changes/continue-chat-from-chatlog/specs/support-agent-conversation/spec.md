## Purpose

Lets an admin resume a specific saved support conversation on `/admin/support-agent` from a validated `?threadId=` entry: the prior transcript is server-rendered and subsequent turns are written to the same thread.

## ADDED Requirements

### Requirement: Validated thread selection entry

The support-agent index SHALL accept a `threadId` query parameter, validate its format, and adopt it only when the thread exists and is owned by the authenticated admin (its resource id equals the admin's user id). A malformed, unknown, or foreign thread id SHALL be ignored and the page SHALL render an empty conversation rather than an error.

#### Scenario: An owned thread is selected

- **WHEN** an admin loads `/admin/support-agent?threadId=<id>` and `<id>` is a stored thread whose resource id is the admin's user id
- **THEN** the page SHALL open that conversation

#### Scenario: A malformed thread id is ignored

- **WHEN** an admin loads the support agent with a `threadId` that does not match the permitted id format
- **THEN** the page SHALL render an empty conversation
- **AND** the response SHALL NOT be an error

#### Scenario: An unknown thread id is ignored

- **WHEN** an admin loads the support agent with a well-formed `threadId` that does not exist
- **THEN** the page SHALL render an empty conversation rather than an error

#### Scenario: A foreign thread id is ignored

- **WHEN** an admin loads the support agent with a `threadId` whose resource id is not the admin's user id
- **THEN** the page SHALL render an empty conversation
- **AND** the foreign conversation SHALL NOT be disclosed

#### Scenario: No thread id still starts a fresh conversation

- **WHEN** an admin loads `/admin/support-agent` without a `threadId`
- **THEN** the page SHALL render an empty conversation as before

### Requirement: Resumed transcript is server-rendered

When a valid owned thread is selected, the system SHALL server-render the conversation's prior turns in the chat area and expose the selected thread id to the streaming client (`data-thread-id`). When no thread is selected, the chat area SHALL be rendered empty and expose no thread id.

#### Scenario: Prior turns are rendered

- **WHEN** an admin opens a selected conversation that has stored user and assistant turns
- **THEN** those turns SHALL be present in the server-rendered chat area
- **AND** the chat area SHALL expose the selected thread id to the client

#### Scenario: A fresh conversation renders empty

- **WHEN** the support agent renders without a selected conversation
- **THEN** the chat area SHALL be empty
- **AND** the chat area SHALL NOT expose a thread id

### Requirement: Subsequent turns continue the selected conversation

The streaming client SHALL send the selected thread id with the next submitted message so the turn is written to the same conversation. A new conversation SHALL be created only when the page has no selected conversation at submission time.

#### Scenario: The first message continues the selected thread

- **WHEN** an admin opens a saved conversation and submits a message
- **THEN** the submitted turn SHALL carry the selected thread id
- **AND** the reply SHALL be written to the same conversation

#### Scenario: A multi-turn conversation stays on one thread

- **WHEN** an admin submits several messages on the same page
- **THEN** every turn after the first SHALL continue the conversation created or selected on that page

#### Scenario: A fresh page starts a new conversation

- **WHEN** an admin submits the first message on a page with no selected conversation
- **THEN** the system SHALL create a new thread for that turn

### Requirement: The write path enforces thread ownership

The message action SHALL accept a supplied thread id only when that thread exists and is owned by the authenticated admin. A malformed, unknown, or foreign thread id SHALL be ignored and the turn SHALL start a new conversation rather than writing to the supplied thread, so an admin cannot write into a customer's conversation through a direct request.

#### Scenario: A foreign thread id is not written to

- **WHEN** a message is submitted with a well-formed thread id whose resource is not the admin's user id
- **THEN** the system SHALL NOT write the turn to that thread
- **AND** the system SHALL create a new thread for the turn

#### Scenario: An unknown thread id is ignored

- **WHEN** a message is submitted with a well-formed thread id that does not exist
- **THEN** the system SHALL start a new conversation instead of failing the turn

### Requirement: The live page outranks captured client state

Thread selection SHALL be resolved from the page currently on screen — its server-rendered thread id — at submission time, not from a value captured by the client entry on a previously displayed page. A thread id that appears only in the URL SHALL NOT be treated as selected, because the server renders the page's thread id exactly when it adopts the requested thread; a URL id without that server-rendered id was unknown or foreign and SHALL be ignored. A page displayed without a selected conversation SHALL NOT continue a conversation from a previously displayed page or from an unadopted URL id.

#### Scenario: A URL id the server did not adopt is not posted

- **WHEN** the page URL carries a thread id the server did not adopt, so the chat area exposes no thread id
- **AND** the admin submits a message
- **THEN** the submitted turn SHALL NOT carry that thread id

#### Scenario: In-app navigation to a fresh page does not continue the old thread

- **WHEN** the client entry served a page with a selected conversation, an in-app navigation replaces the page with one that has no selected conversation, and the admin then submits a message
- **THEN** the submitted turn SHALL NOT carry the previous page's thread id

#### Scenario: A thread created on the current page is reused

- **WHEN** the first message on a page causes the server to create a thread and the admin then submits another message on that same page
- **THEN** the second turn SHALL continue the thread created on that page

### Requirement: Memory failure degrades to an empty conversation

If resolving or recalling the selected conversation fails, the support agent SHALL render an empty conversation rather than an error page. Authentication and admin authorisation SHALL still be enforced.

#### Scenario: Memory unavailable

- **WHEN** the memory store cannot be reached while resolving a selected thread
- **THEN** the page SHALL render an empty conversation
- **AND** the response SHALL NOT be an error

#### Scenario: Unauthenticated access is still redirected

- **WHEN** an unauthenticated user requests the support agent
- **THEN** the system SHALL redirect to the login page
