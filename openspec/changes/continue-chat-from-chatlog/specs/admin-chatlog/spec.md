## Purpose

Makes the admin chatlog a navigable, resumable index of the stored conversations: every thread is classified by who owns it, filterable by that source, shown with the metadata needed to pick the right one, and continuable in the chat surface when it belongs to the current admin.

## ADDED Requirements

### Requirement: Thread list shows source, message count, and last activity

The chatlog list SHALL show, for every conversation, a source label derived from the thread's owning resource id, the number of stored messages in the conversation, and a last-activity ("Letzte Nachricht") timestamp. Rows with no readable messages SHALL still render, with a zero message count and a placeholder instead of a preview. A failure to load a row's metadata SHALL NOT fail the page.

#### Scenario: Rows carry source, message count, and last activity

- **WHEN** an admin opens `/admin/chatlog` and a conversation has stored messages
- **THEN** each row SHALL show the conversation's source label
- **AND** each row SHALL show how many messages the conversation contains
- **AND** each row SHALL show the conversation's last-activity timestamp

#### Scenario: Empty conversation still renders

- **WHEN** a listed thread has no readable messages
- **THEN** its row SHALL render with a zero message count and a preview placeholder
- **AND** the page SHALL NOT fail

#### Scenario: Metadata failure degrades per row

- **WHEN** loading a row's preview or message count fails
- **THEN** the row SHALL render with empty or zero metadata
- **AND** the remaining rows SHALL still render

### Requirement: Threads are classified by source from their resource id

The chatlog SHALL classify every thread by source without any stored source column or backfill: a thread whose resource id equals the current admin's user id is `support`; a thread whose resource id is another numeric id is `customer`; any other (non-numeric) resource id is `legacy`.

#### Scenario: The current admin's own thread is Support

- **WHEN** a thread's resource id equals the authenticated admin's user id
- **THEN** it SHALL be classified as `support`

#### Scenario: Another numeric resource is a customer thread

- **WHEN** a thread's resource id is a numeric id other than the current admin's user id
- **THEN** it SHALL be classified as `customer`

#### Scenario: A non-numeric placeholder is legacy

- **WHEN** a thread's resource id is not numeric (such as `route-user` or `test-user`)
- **THEN** it SHALL be classified as `legacy`

#### Scenario: Classification is derived, never stored

- **WHEN** the chatlog classifies threads
- **THEN** it SHALL read the classification from the thread's resource id at request time
- **AND** it SHALL NOT require a schema change or a data migration

### Requirement: Source filter bar with per-source counts

The chatlog SHALL render a source filter bar offering Alle, Support, Kunden, and Sonstige, each showing the count of matching threads. Selecting a source SHALL narrow the list to that source and reset pagination to the first page. An unrecognised filter value SHALL be treated as Alle rather than as an error.

#### Scenario: Selecting a source narrows the list

- **WHEN** an admin selects the Support filter
- **THEN** the list SHALL show only `support` threads
- **AND** the active filter SHALL be highlighted

#### Scenario: Counts are shown per source

- **WHEN** the filter bar renders
- **THEN** each option SHALL show the number of threads classified as that source

#### Scenario: Unknown filter falls back to all

- **WHEN** the `source` query parameter is absent or not one of the known values
- **THEN** the list SHALL show every thread as Alle
- **AND** the page SHALL NOT fail

#### Scenario: Filter survives pagination and transcript navigation

- **WHEN** an admin filters the list by source and then paginates or opens a transcript
- **THEN** the resulting navigation SHALL carry the active source filter

### Requirement: Continue a saved conversation in the chat

For a conversation owned by the current admin (`support` source), the transcript pane SHALL offer an "Im Chat fortsetzen" control that navigates to the support agent with that thread selected. The navigation crosses the admin frame boundary, so it SHALL be a full document navigation (the control carries `data-rmx-document`), not a frame swap. Conversations classified as `customer` or `legacy` SHALL NOT offer the control, and the chatlog SHALL NOT provide any path that writes an admin turn into a customer's conversation.

#### Scenario: An own support conversation offers continue

- **WHEN** an admin opens the transcript of a conversation whose resource id is their own user id
- **THEN** the pane SHALL show an "Im Chat fortsetzen" control linking to the support agent with that thread id

#### Scenario: Continue crosses frames as a document navigation

- **WHEN** the continue control is rendered inside the nested transcript frame
- **THEN** it SHALL carry `data-rmx-document`
- **AND** activating it SHALL perform a document-level navigation rather than replacing a frame

#### Scenario: Customer and legacy conversations stay read-only

- **WHEN** an admin opens the transcript of a `customer` or `legacy` conversation
- **THEN** the pane SHALL NOT show a continue control

### Requirement: Source classification and counts come from a bounded sweep

Because the memory layer can only filter threads by an exact resource id, the chatlog SHALL derive classification and per-source counts from a bounded full sweep of stored threads. A sweep failure SHALL degrade to the existing empty state rather than an error response.

#### Scenario: A sweep drives the filter and counts

- **WHEN** the chatlog renders its list and filter bar
- **THEN** it SHALL read the stored threads in a bounded sweep
- **AND** it SHALL classify each one in memory to build the filtered page and the counts

#### Scenario: Sweep failure degrades

- **WHEN** the thread sweep fails
- **THEN** the page SHALL render its empty state
- **AND** the response SHALL NOT be an error

### Requirement: The chatlog stays a master–detail page

The chatlog SHALL keep rendering the conversation list and a sticky transcript pane together; opening a transcript SHALL load only the transcript pane and leave the list, its page, and its filter in place. Delete and dismiss controls SHALL return to the same list page and source filter.

#### Scenario: Opening a transcript keeps the list

- **WHEN** an admin opens a conversation from the list
- **THEN** the list SHALL remain rendered
- **AND** only the transcript pane SHALL change

#### Scenario: Delete returns to the same page and filter

- **WHEN** an admin deletes a conversation from a filtered, paginated list
- **THEN** the redirect SHALL return to the same offset and source filter
