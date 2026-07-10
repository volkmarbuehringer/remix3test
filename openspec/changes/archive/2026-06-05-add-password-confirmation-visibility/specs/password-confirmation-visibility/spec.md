## ADDED Requirements

### Requirement: Register form requires password confirmation

The register page SHALL include a second password field labeled "Confirm password" that the user must fill in. The form SHALL only allow submission when both password fields contain identical values.

#### Scenario: Register page renders with confirmation field

- **WHEN** user navigates to `GET /auth/register`
- **THEN** the page renders a "Password" field and a "Confirm password" field
- **AND** both fields have `type="password"` by default

#### Scenario: Passwords match — form submits normally

- **WHEN** user enters the same value in both password and confirm password fields
- **THEN** the confirm password field shows no error
- **AND** the form can be submitted normally

#### Scenario: Passwords do not match — error shown

- **WHEN** user enters different values in the password and confirm password fields
- **THEN** an error message "Passwords do not match" is displayed below the confirm password field
- **AND** the form submit button is disabled or the form submission is prevented

### Requirement: Password fields have visibility toggle

Every password input field on the register page and reset password page SHALL have an adjacent button that toggles the input type between `password` (hidden) and `text` (visible).

#### Scenario: Toggle reveals password

- **WHEN** user clicks the visibility toggle button next to a password field that is currently hidden
- **THEN** the input `type` changes from `password` to `text`
- **AND** the button icon changes from an "eye-off" icon to an "eye" icon

#### Scenario: Toggle hides password

- **WHEN** user clicks the visibility toggle button next to a password field that is currently shown
- **THEN** the input `type` changes from `text` to `password`
- **AND** the button icon changes from an "eye" icon to an "eye-off" icon

#### Scenario: Toggle does not affect form submission

- **WHEN** user toggles password visibility on any field and submits the form
- **THEN** the submitted password value is the actual text entered, regardless of visibility state

### Requirement: PasswordField is a reusable shared component

The system SHALL provide a `PasswordField` component that encapsulates a password input with a visibility toggle button.

`PasswordField` SHALL accept:

- `name: string` — the input name attribute
- `autoComplete?: string` — optional autocomplete hint
- `minLength?: number` — optional minimum length attribute
- `error?: string` — optional error message displayed below the input
- `label: string` — the label text above the input

`PasswordField` SHALL render:

- A `<label>` element with `fieldLabelCss` mixin
- A `<span>` with the label text
- An input wrapper containing the `<input>` field and a `<button>` toggle
- The toggle button with an eye/eye-off inline SVG icon
- Optional error `<span>` below the input

#### Scenario: PasswordField renders label and input

- **WHEN** a `PasswordField` is rendered with label "Password" and name "password"
- **THEN** a label with text "Password" is displayed
- **AND** an `<input type="password" name="password">` is rendered

#### Scenario: PasswordField renders error

- **WHEN** a `PasswordField` is rendered with `error="Required"`
- **THEN** an element with `role="alert"` displays "Required" below the input

#### Scenario: PasswordField toggle changes input type

- **WHEN** user clicks the toggle button on a `PasswordField`
- **THEN** the input type attribute toggles between `password` and `text`
- **AND** the icon toggles between eye-off and eye states
