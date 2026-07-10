## ADDED Requirements

### Requirement: AI routes are nested under /ai/

The Chat and Agent routes SHALL be nested under an `/ai/` URL prefix instead of top-level `/chat` and `/agent`.

#### Scenario: Chat route is under /ai/chat

- **WHEN** a GET request is made to `/ai/chat`
- **THEN** the server SHALL return the chat interface page

#### Scenario: Agent route is under /ai/agent

- **WHEN** a GET request is made to `/ai/agent`
- **THEN** the server SHALL return the agent interface page

### Requirement: AI dashboard index page at /ai

The system SHALL provide a dashboard index page at `/ai` that displays overview cards for available AI features.

#### Scenario: Dashboard returns 200

- **WHEN** a GET request is made to `/ai`
- **THEN** the server SHALL return a 200 response with the AI dashboard page

#### Scenario: Dashboard shows Chat and Agent cards

- **WHEN** a user visits `/ai`
- **THEN** the dashboard SHALL display cards with links to Chat and Agent

### Requirement: AI section has sidebar layout with frame navigation

The AI section SHALL use a sidebar layout (similar to admin) with frame-based navigation for partial page updates.

#### Scenario: AI layout renders sidebar

- **WHEN** a user visits any `/ai/*` page
- **THEN** the page SHALL render with an AI sidebar navigation

#### Scenario: Frame navigation works in AI section

- **WHEN** a user clicks a navigation link in the AI sidebar
- **THEN** the content SHALL update via frame navigation (partial page update)

### Requirement: Internal links use new AI URLs

All internal links and redirects SHALL use `/ai/chat` and `/ai/agent` instead of `/chat` and `/agent`.

#### Scenario: Chat form action points to /ai/chat

- **WHEN** the chat page renders a form
- **THEN** the form action SHALL point to `/ai/chat`

#### Scenario: Agent form action points to /ai/agent

- **WHEN** the agent page renders a form
- **THEN** the form action SHALL point to `/ai/agent`

#### Scenario: Chat POST redirects to /ai/chat

- **WHEN** a POST to `/ai/chat` succeeds
- **THEN** the redirect SHALL point to `/ai/chat?chatId=X`

#### Scenario: Nav links point to /ai/chat and /ai/agent

- **WHEN** the navigation renders
- **THEN** Chat and Agent links SHALL point to `/ai/chat` and `/ai/agent`

#### Scenario: Admin chatlog links to /ai/chat and /ai/agent

- **WHEN** the admin chatlog page renders conversation links
- **THEN** links SHALL point to `/ai/chat?chatId=X` and `/ai/agent?agentId=X`
