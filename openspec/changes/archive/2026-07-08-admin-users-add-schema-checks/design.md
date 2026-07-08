## Context

The `app/actions/admin/users/controller.tsx` defines two form schemas (`userCreateSchema`, `userUpdateSchema`) that currently accept `s.defaulted(s.string(), '')` for `name` and `email` without any `data-schema/checks` — the email field lacks `.pipe(email())` and the name field lacks `.pipe(minLength(1))`. Instead, validation is done manually after parse: a local `EMAIL_RE` regex at line 34, plus `if (!fields.name || !fields.name.trim())` and `if (!fields.email || !EMAIL_RE.test(fields.email))` blocks in the `create` action (lines 131-136) and `if (fields.email && !EMAIL_RE.test(fields.email))` in the `update` action (line 199).

Meanwhile, other controllers (auth, nutzer, client) already use `.pipe(email())` and `.pipe(minLength(...))` in their schemas. The data-table layer (`app/data/schema.ts`) also has its own copy of the same email regex at line 119. This change removes one of the three copies.

## Goals / Non-Goals

**Goals:**
- Add `.pipe(email())` to the `email` field in both `userCreateSchema` and `userUpdateSchema`
- Add `.pipe(minLength(1))` to the `name` field in both schemas
- Remove the `EMAIL_RE` constant and the manual `if/throw` validation blocks for name/email that are now covered by schema checks
- Keep existing error response behavior (400 with JSON `{ ok: false, error: ... }`)

**Non-Goals:**
- Not modifying the data-table layer's email regex in `app/data/schema.ts` (separate layer, out of scope)
- Not touching password validation (uses `validatePasswordComplexity()` — not expressible as a simple check)
- Not changing the nutzer controller or any other controller
- Not changing error message wording

## Decisions

**1. Add `email()` and `minLength(1)` checks to schemas**
- Rationale: These are the same checks used by every other controller that validates name/email. They produce parse errors with proper error codes and integrate with `issueToFieldErrors()` if we wanted field-level errors later.
- Alternative considered: keeping manual validation and just importing the shared `EMAIL_RE` — but that still misses parse-time catching and field-level error reporting.

**2. Keep manual password validation**
- Rationale: `validatePasswordComplexity()` does more than `minLength` — it checks character class requirements. That's a `.refine()` at minimum, and it has custom error messages. Not worth converting.

**3. Return schema parse failures as generic JSON error**
- Rationale: The current code returns `{ ok: false, error: 'Invalid form data' }` with status 400 on parse failure (line 127). After adding checks, a failed parse means schema validation caught `name` or `email` being invalid. We keep the same generic response to minimize diff and behavior change. The schema checks act as a guard that prevents bad data from reaching the manual validation blocks.

## Risks / Trade-offs

- **[Low] Schema parse error swallows detail**: The generic "Invalid form data" response doesn't tell the user which field failed. Previously the manual checks had specific messages ("Name is required", "Invalid email format"). However, this is an admin-only controller — the form is rendered with client-side validation, and the generic error is a fallback. If field-level feedback is needed later, it's straightforward to switch to `issueToFieldErrors()`.
- **[Low] Name field behavior change**: Currently `s.defaulted(s.string(), '')` with `if (!fields.name || !fields.name.trim())` allows whitespace-only names to be caught. After `.pipe(minLength(1))`, the raw string "   " has length 3 and would pass the check. However, the data-table layer's `users.beforeWrite()` trims the name, so a whitespace-only name would become empty and be caught by the data-table `validate()`. This is the same behavior as other controllers.
