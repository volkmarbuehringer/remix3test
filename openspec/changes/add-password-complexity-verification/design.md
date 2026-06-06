## Context

The app already has a `validatePasswordComplexity()` function in `app/utils/password-complexity.ts` that enforces: min length 10, at least one digit, at least one special character. This function is used in the settings change-password flow but is absent from the registration and password-reset controllers, which only apply `minLength(9)`.

The existing settings-page implementation provides a proven pattern: schema-level `minLength` using `PASSWORD_MIN_LENGTH`, a server-side validation call after schema parse, and inline client-side live complexity feedback via an injected `<script>`.

## Goals / Non-Goals

**Goals:**
- Enforce password complexity on the registration form
- Enforce password complexity on the password-reset form
- Provide real-time client-side complexity feedback on both forms
- Reuse the existing `validatePasswordComplexity()` and `PASSWORD_MIN_LENGTH` constants

**Non-Goals:**
- Changing the complexity rules themselves (min length, digit, special char)
- Modifying the settings change-password flow (already complete)
- Adding uppercase or other new complexity rules
- Backend password history checks or breached-password detection

## Decisions

1. **Reuse existing utility, don't duplicate** — The `password-complexity.ts` module is already tested and used in settings. Importing it into registration and password-reset is simpler and more maintainable than duplicating logic.

2. **Raise schema minLength to PASSWORD_MIN_LENGTH (10)** — Currently both registration and password-reset use `minLength(9)`. Since the complexity validator enforces ≥10, the schema-level check should match to fail fast before the more expensive validator.

3. **Client-side feedback via inline `<script>` (same pattern as settings)** — The settings page uses a small inline script injected next to the password field that checks length, digit, and special char in real time and renders a checklist. Reusing this approach avoids adding a separate client-entry component or JS bundle.

4. **Validate after password-match check** — In both registration and reset controllers, check `password === confirmPassword` first, then check `validatePasswordComplexity(password)`. This ensures a clear, single error message per validation concern.

## Risks / Trade-offs

- The inline script approach duplicates the regex logic client-side (cannot import TS into inline string). This is acceptable — same trade-off already made in settings, and the rules rarely change.
- Bumping minLength from 9 to 10 may cause existing draft passwords to fail. Mitigation: this is a pre-submit UX change affecting future registrations only, not existing users.
