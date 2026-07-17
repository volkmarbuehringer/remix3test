## ADDED Requirements

### Requirement: Multi-line text input
The input field SHALL be a `<textarea>` element with 3 visible rows and disabled resize, replacing the current single-line `<input type="text">`.

#### Scenario: Input displayed as textarea
- **WHEN** the support agent page loads
- **THEN** the input field is a `<textarea>` with `rows="3"` and `resize: none`

#### Scenario: Multi-line text entry
- **WHEN** the user types text that spans multiple lines using Shift+Enter
- **THEN** the textarea displays all lines without growing beyond 3 visible rows (scroll within the textarea)

### Requirement: Enter-to-submit, Shift+Enter for newline
Pressing Enter in the textarea SHALL submit the form. Pressing Shift+Enter SHALL insert a newline without submitting.

#### Scenario: Enter submits form
- **WHEN** the user presses Enter in the textarea (without Shift)
- **THEN** the form is submitted with the current textarea content

#### Scenario: Shift+Enter inserts newline
- **WHEN** the user presses Shift+Enter in the textarea
- **THEN** a newline is inserted in the textarea and the form is NOT submitted

#### Scenario: Submit button still works
- **WHEN** the user clicks the "Senden" button
- **THEN** the form is submitted with the current textarea content

### Requirement: Input cleared on submit
After successful form submission, the textarea SHALL be cleared.

#### Scenario: Input cleared after send
- **WHEN** the user submits a message
- **THEN** the textarea value is cleared to prepare for the next message
