## MODIFIED Requirements

### Requirement: Register page uses AuthShell/AuthForm card layout

The register page SHALL render using the shared `AuthShell` and `AuthForm` components, replacing the previous generic panel layout.

The page SHALL display:
- Eyebrow text "Get started" (uppercase, muted, 12px)
- Title "Create your account" (28px, primary color, tight line-height)
- Description text "Fill in your details to create a new account."
- Name and email input fields (using `input.base`/`input.focus` mixins)
- A password field with visibility toggle (`PasswordField` component)
- A confirm password field with visibility toggle (`PasswordField` component)
- Client-side validation that the two password fields match
- A full-width primary "Create account" submit button
- Footer link: "Already have an account? Login here" pointing to `/login`

The card SHALL use the same dimensions and styling as the login card (420px max-width, shadow, border-radius matching AuthShell defaults).

#### Scenario: User visits register page

- **WHEN** user navigates to `GET /auth/register`
- **THEN** system returns a 200 HTML response with the centered-card register form
- **AND** the page is wrapped in `Layout` for consistent header/footer navigation
- **AND** both the password and confirm password fields have visibility toggle buttons

#### Scenario: Password confirmation validates on client

- **WHEN** user types mismatched passwords in the register form
- **THEN** a "Passwords do not match" error appears below the confirm password field
- **AND** the form submit is prevented

#### Scenario: Password toggle reveals password text

- **WHEN** user clicks the visibility toggle on the password or confirm password field
- **THEN** the field text becomes visible and the icon changes to indicate the visible state

### Requirement: Register page displays errors in timeboxer-style banner

The register page SHALL display validation, duplicate-email, and rate-limit errors in the same danger-colored error banner as the login page.

#### Scenario: Duplicate email

- **WHEN** user registers with an already-taken email
- **THEN** system returns 400 with the page re-rendered
- **AND** an error banner displays "An account with this email already exists."

#### Scenario: Invalid input

- **WHEN** user submits with missing fields or bad email format
- **THEN** system returns 400 with the page re-rendered
- **AND** an error banner displays the validation error message

#### Scenario: Rate limited

- **WHEN** user exceeds registration attempt limits
- **THEN** system returns 429 with the page re-rendered
- **AND** the error banner displays "Too many registration attempts. Please try again later."
