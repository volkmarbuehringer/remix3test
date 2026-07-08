## Why

The admin/users controller has a validation gap — its action-level schema doesn't use `email()` or `minLength()` checks from `data-schema/checks`. Instead it uses manual `if/throw` validation with an inline email regex (`EMAIL_RE`), duplicating logic already available in the framework. This increases drift risk and misses the opportunity for field-level error reporting at parse time.

## What Changes

- Add `.pipe(email())` to the `email` field in both `userCreateSchema` and `userUpdateSchema`
- Add `.pipe(minLength(1))` to the `name` field in both schemas
- Remove the inline `EMAIL_RE` constant and the manual `if/throw` validation blocks that are now covered by the schema
- No new capabilities — this is a validation consolidation within an existing controller

## Capabilities

### New Capabilities

None — this change does not introduce new capabilities.

### Modified Capabilities

None — this is an implementation improvement within existing code, not a spec-level behavior change.

## Impact

- `app/actions/admin/users/controller.tsx` — schema fields gain checks, manual validation removed
- One of three email regex copies removed (the other two remain in `app/data/schema.ts` and `checks.email()`)
- Field-level error messages now come from the schema parse instead of manual `if/throw` blocks
