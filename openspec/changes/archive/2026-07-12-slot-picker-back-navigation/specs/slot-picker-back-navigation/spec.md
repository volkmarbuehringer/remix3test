## ADDED Requirements

### Requirement: Slot picker "Schließen" button

The slot picker SHALL display a "Schließen" button that removes the picker from the DOM and re-enables the text input form. This SHALL be a purely client-side action with no agent interaction.

#### Scenario: User closes the slot picker

- **WHEN** the slot picker is displayed
- **AND** the user clicks "Schließen"
- **THEN** the slot picker DOM element SHALL be removed
- **AND** the chat input form SHALL be re-enabled
- **AND** no message SHALL be sent to the agent

### Requirement: Slot picker "Andere Ressource" button

The slot picker SHALL display an "Andere Ressource" button that sends the message "Ich möchte eine andere Ressource ausprobieren." to the agent via POST /chat, triggering a new agent turn. The agent SHALL re-search with the same query terms from the previous search and present the available resources.

#### Scenario: User selects another resource

- **WHEN** the slot picker is displayed for a resource from a multi-result search
- **AND** the user clicks "Andere Ressource"
- **THEN** a user message "Ich möchte eine andere Ressource ausprobieren." SHALL be appended to the chat
- **AND** a POST /chat request SHALL be sent with this message
- **AND** the agent SHALL re-execute search_resources_by_capability with the same query terms
- **AND** the agent SHALL present the results via ask_user for user selection

#### Scenario: No other resources available

- **WHEN** the slot picker is displayed for the only matching resource from the search
- **AND** the user clicks "Andere Ressource"
- **THEN** the agent SHALL inform the user that no other resources are available
- **AND** the user SHALL be able to type a new search query

### Requirement: Agent handles "other resource" request

The agent instructions SHALL include a rule for handling the "other resource" request during slot display. The agent SHALL search with the same terms as the previous search using search_resources_by_capability.

#### Scenario: Agent processes "other resource" request

- **WHEN** the user requests a different resource (via button click or text) while slots were displayed
- **THEN** the agent SHALL call search_resources_by_capability with the same query terms as the previous search
- **AND** if multiple resources exist, present them via ask_user with "Ich habe mehrere passende Ressourcen gefunden. Welche spricht Sie am meisten an?"
- **AND** if only the same resource matches, inform the user that no other resources are available and suggest a new search
