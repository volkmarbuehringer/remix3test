## 1. Schema & Import Changes

- [x] 1.1 Add `email` to the `data-schema/checks` import in `app/actions/admin/users/controller.tsx`
- [x] 1.2 Add `.pipe(email())` to the `email` field in `userCreateSchema`
- [x] 1.3 Add `.pipe(minLength(1))` to the `name` field in `userCreateSchema`
- [x] 1.4 Add the same `.pipe(email())` and `.pipe(minLength(1))` to `userUpdateSchema`

## 2. Remove Manual Validation

- [x] 2.1 Remove the `EMAIL_RE` constant at line 34
- [x] 2.2 Remove the manual name check block in `create` (lines 131-133: `if (!fields.name || !fields.name.trim())`)
- [x] 2.3 Remove the manual email check block in `create` (lines 134-136: `if (!fields.email || !EMAIL_RE.test(fields.email))`)
- [x] 2.4 Remove the manual email check in `update` (lines 199-201: `if (fields.email && !EMAIL_RE.test(fields.email))`)

## 3. Update Tests

- [x] 3.1 Update `rejects missing name` test to match the new generic error response (parse failure returns `"Invalid form data"` instead of `"Name is required"`)
- [x] 3.2 Update `rejects invalid email` test to match the new generic error response (parse failure returns `"Invalid form data"` instead of the EMAIL_RE error)

## 4. Verify

- [x] 4.1 Run `npm test` to confirm all tests pass
- [x] 4.2 Run `npm run typecheck` to confirm no type errors
