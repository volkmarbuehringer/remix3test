## ADDED Requirements

### Requirement: Conversation history is resumed on load

The `index` route SHALL rehydrate the authenticated user's most recent conversation from agent memory on page load instead of always rendering an empty conversation area. The most recent thread for the user SHALL be resolved and its prior turns SHALL be server-rendered so the customer sees their past conversation after a refresh, tab return, or navigation. When the user has no prior conversation (or explicitly starts a new one), the page SHALL render an empty conversation area. Turns SHALL continue to be persisted to agent memory as the conversation advances.

#### Scenario: Returning customer sees their conversation

- **WHEN** an authenticated customer loads `/chat` and has a prior conversation stored for their resource
- **THEN** the page SHALL render the prior turns as server-rendered conversation bubbles
- **AND** the page SHALL expose the resumed thread id to the streaming client so subsequent messages continue the same thread

#### Scenario: Fresh user sees an empty conversation

- **WHEN** an authenticated customer loads `/chat` and has no prior stored conversation
- **THEN** the page SHALL render an empty conversation area with no server-rendered message history

#### Scenario: Turns are still persisted to memory

- **WHEN** the agent produces a reply during a streamed turn
- **THEN** the turn SHALL be written to the user's conversation memory under the active thread and resource

### Requirement: New conversation control

The customer chat SHALL expose a control to start a new conversation, which clears the active thread and renders an empty conversation area. The next submitted message after activating the control SHALL begin a fresh thread rather than extending the previous one.

#### Scenario: Starting a new conversation clears history

- **WHEN** a customer with an active conversation activates the new-conversation control
- **THEN** the active thread SHALL be cleared and the conversation area SHALL be rendered empty
- **AND** subsequent messages SHALL be written to a new thread

### Requirement: Customer chat UI conforms to theme tokens

The customer chat interface SHALL source all visual styling from theme tokens rather than hardcoded colors, so the interface adapts to the active theme (including dark mode) without per-component overrides.

#### Scenario: Bubbles and cards use theme tokens

- **WHEN** the chat renders user bubbles, assistant bubbles, tool cards, approval cards, question cards, and the slot picker
- **THEN** the background, foreground, border, and surface colors SHALL derive from theme tokens

#### Scenario: No hardcoded color literals remain

- **WHEN** the customer chat rendering is inspected
- **THEN** there SHALL be no hardcoded hex color literals in the chat rendering

### Requirement: Customer chat is screen-reader and keyboard accessible

The customer chat interface SHALL announce new turns to assistive technology and SHALL be operable by keyboard, including focus management across submit, answer, approval, and slot-selection flows, and a visible busy state while the agent is streaming.

#### Scenario: New turns are announced

- **WHEN** a new message is appended to the conversation
- **THEN** the conversation container SHALL expose a live region that announces the new turn to assistive technology

#### Scenario: Focus is managed and busy state is shown

- **WHEN** the customer submits a message, answers a question, approves/declines a tool decision, or picks a slot
- **THEN** focus SHALL move to a predictable element (the new message, the composer, or the activated control)
- **AND** a visible busy or thinking state SHALL be shown while the agent is streaming

#### Scenario: Interactive controls are keyboard operable

- **WHEN** the customer navigates the tool approval, question, or slot-picker controls
- **THEN** all controls SHALL be reachable and operable via keyboard

## REMOVED Requirements

### Requirement: Conversation history is session-scoped on load

**Reason**: A prior design decision kept the customer chat empty on page load for simplicity; no security or transport requirement prevents restoring the conversation, and the loss of history on refresh is confusing for customers.

**Migration**: `GET /chat` now rehydrates the most recent thread and exposes it to the streaming client. Customers can start a fresh conversation with the new-conversation control.
