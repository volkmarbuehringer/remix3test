## ADDED Requirements

### Requirement: Agent requires MIME-type confirmation before upload navigation

The route agent SHALL ask the user to select a MIME type before navigating to `/uploads`. The agent SHALL navigate only if the user selects "PDF".

#### Scenario: Agent asks MIME type before /uploads navigation

- **WHEN** the user asks to view uploads or navigate to `/uploads`
- **THEN** the agent SHALL call `askUserTool` with a question about the desired MIME type
- **AND** the options SHALL include "PDF", "JPEG", and "PNG" with descriptions
- **AND** `selectionMode` SHALL be `"single_select"`

#### Scenario: PDF confirmed → navigates to /uploads

- **WHEN** the user selects "PDF" in response to the MIME-type question
- **THEN** the agent SHALL call `routeNavigate('/uploads')`

#### Scenario: Non-PDF selected → returns text response

- **WHEN** the user selects "JPEG" or "PNG" in response to the MIME-type question
- **THEN** the agent SHALL NOT call `routeNavigate`
- **AND** SHALL return a text message informing the user that only PDF uploads are supported
