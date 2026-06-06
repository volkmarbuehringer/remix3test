## Why

Passwords without complexity requirements are weak and expose the platform to credential-stuffing and brute-force attacks. The password-complexity validator (`app/utils/password-complexity.ts`) already exists and is used in the settings page change-password flow, but is missing from both the registration and password-reset flows — leaving the two primary password-creation paths unenforced.

## What Changes

- Wire `validatePasswordComplexity()` into the **registration** controller after schema validation and password-match check
- Wire `validatePasswordComplexity()` into the **password-reset** controller (`auth-forgotten`) after schema validation and password-match check
- Raise schema-level `minLength` from 9 to `PASSWORD_MIN_LENGTH` (10) in both registration and password-reset schemas
- Add client-side live complexity feedback (inline checklist) to registration and password-reset forms, matching the existing settings-page pattern
- Update existing tests and snapshots as needed

## Capabilities

### New Capabilities

- `password-complexity`: Enforce password strength rules (min length 10, ≥1 digit, ≥1 special character) on all password-creation flows — registration, password reset, and settings change-password

### Modified Capabilities

<!-- No existing capabilities have spec-level requirement changes. -->

## Impact

- `app/actions/auth-register/controller.tsx` — add import, validation call, form feedback, schema minLength bump
- `app/actions/auth-forgotten/controller.tsx` — add import, validation call, form feedback, schema minLength bump
- `app/utils/password-complexity.ts` — no changes needed (already correct)
- `app/utils/password-complexity.test.ts` — no changes needed (already passing)
