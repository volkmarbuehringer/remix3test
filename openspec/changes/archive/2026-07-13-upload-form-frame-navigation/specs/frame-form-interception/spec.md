## ADDED Requirements

### Requirement: Forms inside a child Frame submit without full-page navigation

When a `<form>` inside a named Frame (child frame, not the top-level document) is submitted, the submission SHALL be handled asynchronously via `fetch` and the response rendered into the frame in-place, keeping the parent document and other frames intact.

#### Scenario: File upload form in route-agent's frame

- **WHEN** the user clicks "Hochladen" on the upload form inside the route-agent's `lists-content` Frame
- **THEN** the form submission SHALL NOT navigate the main window
- **THEN** the upload SHALL be processed by the server
- **THEN** the frame content SHALL update to show the result (success banner, updated file list, upload form ready for another upload)
- **THEN** the route-agent input bar and message history SHALL remain visible and functional

#### Scenario: Form submission with network error

- **WHEN** the fetch request fails
- **THEN** the submit button SHALL be re-enabled
- **THEN** the user SHALL be able to retry the submission

#### Scenario: Direct access (no parent frame)

- **WHEN** the uploads page is accessed directly (not inside the route-agent's frame)
- **THEN** the form submission SHALL still work — the page content SHALL update correctly after upload
