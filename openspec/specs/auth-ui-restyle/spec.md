## ADDED Requirements

### Requirement: Login page uses AuthShell/AuthForm card layout

The login page SHALL render using the shared `AuthShell` and `AuthForm` components from `app/ui/auth-card.tsx`, replacing the previous generic panel layout.

The page SHALL display:

- The newapp brand mark (colored dot + "newapp" label) above the title
- Eyebrow text "Welcome back" (uppercase, muted, 12px)
- Title "Sign in to newapp" (28px, primary color, tight line-height)
- Description text "Use your email and password to continue."
- Email and password input fields (using `input.base`/`input.focus` mixins)
- A full-width primary "Sign in" submit button
- Footer link: "Don't have an account? Register here" pointing to `/register`

The card SHALL be centered in the viewport with:

- Max-width 420px
- Surface background (`theme.surface.lvl1`)
- Subtle border (`theme.colors.border.subtle`)
- Extra-large border radius (`theme.radius.xl`, 16px)
- Large shadow (`theme.shadow.lg`)
- Extra-large padding (`theme.space.xl`, 24px)

#### Scenario: User visits login page

- **WHEN** user navigates to `GET /login`
- **THEN** system returns a 200 HTML response with the centered-card login form
- **AND** the page is wrapped in `Layout` for consistent header/footer navigation

#### Scenario: Login page preserves returnTo parameter

- **WHEN** user navigates to `GET /login?returnTo=/admin/dashboard`
- **THEN** the form action URL includes `?returnTo=%2Fadmin%2Fdashboard`
- **AND** successful login redirects to `/admin/dashboard`

### Requirement: Login page displays errors in timeboxer-style banner

The login page SHALL display authentication and rate-limit errors in a visual banner with danger background, danger border, and danger foreground text.

#### Scenario: Invalid credentials

- **WHEN** user submits login with bad password
- **THEN** system returns 401 with the page re-rendered
- **AND** an error banner with role="alert" displays "Invalid email or password."
- **AND** the banner has danger background color, danger border, and danger foreground text
- **AND** the banner has adequate padding and border-radius

#### Scenario: Rate limited

- **WHEN** user exceeds login attempt limits
- **THEN** system returns 429 with the page re-rendered
- **AND** the error banner displays the rate-limit message

#### Scenario: Invalid format

- **WHEN** user submits with malformed email
- **THEN** system returns 400 with the page re-rendered
- **AND** the error banner displays "Invalid email or password format."

### Requirement: Login page demo hints remain available

The login page SHALL display demo account hints inside the card footer when `NODE_ENV` is not `'production'`, showing admin and customer demo credentials.

#### Scenario: Development environment shows demo accounts

- **WHEN** running in development mode
- **THEN** the login card footer includes a demo account box listing admin and customer credentials

#### Scenario: Production environment hides demo accounts

- **WHEN** running in production mode
- **THEN** the login card does NOT display demo account hints

### Requirement: Register page uses AuthShell/AuthForm card layout

The register page SHALL render using the shared `AuthShell` and `AuthForm` components, replacing the previous generic panel layout.

The page SHALL display:

- Eyebrow text "Get started" (uppercase, muted, 12px)
- Title "Create your account" (28px, primary color, tight line-height)
- Description text "Fill in your details to create a new account."
- Name and email input fields (using `input.base`/`input.focus` mixins)
- A password field with visibility toggle
- A confirm password field with visibility toggle
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

### Requirement: AuthShell and AuthForm are reusable shared components

The system SHALL provide `AuthShell` and `AuthForm` components in `app/ui/auth-card.tsx` that encapsulate the centered-card layout and form boilerplate respectively.

`AuthShell` SHALL accept:

- `eyebrow: string` — rendered as uppercase, muted, small text above the title
- `title: string` — rendered as the primary heading
- `description: string` — rendered as secondary body text below the title
- `header?: RemixNode` — optional content rendered above the eyebrow
- `children?: RemixNode` — rendered after the description, inside the card

`AuthShell` SHALL render:

- A centered grid container (min-height: calc(100vh - 80px), centered items)
- A card div with border, shadow, border-radius, padding, and surface background
- Eyebrow paragraph, title heading (h1), and description paragraph

`AuthForm` SHALL accept:

- `action: string` — the form action URL
- `children: RemixNode` — field inputs rendered between the error banner and submit button
- `submitLabel: string` — text for the submit button
- `error?: string` — optional form-level error displayed in the banner
- `footer?: RemixNode` — optional content rendered below the submit button

`AuthForm` SHALL render:

- A `<form>` tag with the given action and POST method
- A `<CsrfTokenInput />` component (newapp's CSRF pattern)
- A conditional error banner (role="alert", danger colors) when `error` is set
- The `children` content (field inputs)
- A full-width primary `Button` with the `submitLabel`
- The optional `footer` content

#### Scenario: AuthShell renders with all props

- **WHEN** an `AuthShell` is rendered with eyebrow "Test", title "Hello", description "World", and child content
- **THEN** the DOM contains the eyebrow text, an h1 with the title, the description text, and the child content inside a bordered, shadowed card

#### Scenario: AuthForm renders with error

- **WHEN** an `AuthForm` is rendered with an error string "Something went wrong"
- **THEN** the form contains an element with role="alert" displaying "Something went wrong"
- **AND** the element has danger background and border colors

#### Scenario: AuthForm renders without error

- **WHEN** an `AuthForm` is rendered without an error prop
- **THEN** no error banner is present in the DOM

### Requirement: Auth pages preserve all existing auth behavior

The login and register controllers SHALL NOT change their auth logic, validation, rate limiting, session management, or redirect behavior. Only the `context.render()` calls and page component rendering SHALL change.

#### Scenario: Login with valid credentials still works

- **WHEN** user submits login with demo account email and password
- **THEN** session is set, session ID is regenerated, and user is redirected to the home page (or returnTo URL)

#### Scenario: Registration with valid input still works

- **WHEN** user submits registration with new name, email, and password
- **THEN** user is created in the database, session is set, and user is redirected to home page

#### Scenario: CSRF protection still active

- **WHEN** a form POST lacks a valid CSRF token
- **THEN** the request is rejected by CSRF middleware

### Requirement: Auth card supports dark theme

The auth card SHALL use theme tokens (not hardcoded colors) so that the card background, text colors, borders, and shadows adapt to the active theme (light or dark).

#### Scenario: Dark theme applied

- **WHEN** the document has `data-theme="dark"`
- **THEN** the auth card background, text, and border colors reflect the dark theme palette
