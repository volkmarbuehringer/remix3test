## ADDED Requirements

### Requirement: Webhook compose page renders a single HTML document

The `/webhook-requests/create` page SHALL render exactly one HTML document (one `<html>` root element) with the page title set on the document's `<title>`.

#### Scenario: Page emits a single html root

- **WHEN** the admin navigates to `/webhook-requests/create`
- **THEN** the response SHALL contain exactly one `<html>` root element
- **THEN** the document SHALL NOT nest a second `<html>` element inside the `<body>`

#### Scenario: Page title preserved

- **WHEN** the admin navigates to `/webhook-requests/create`
- **THEN** the document `<title>` SHALL be `Webhook erstellen`
