# Password Form Patterns

## What This Covers

Three password-specific concerns that standard form error handling doesn't cover:

1. **Cross-field validation** — `minLength(8)` checks one field; `password === confirmPassword` needs a post-parse check.
2. **Security leak via `defaultValue`** — preserving submitted values with `defaultValue` on a password input exposes the plaintext password in the HTML source, even though the browser masks it as dots.
3. **Password visibility toggle** — no built-in toggle; use the nonce'd inline-script pattern so early clicks are not lost to the `clientEntry` import gap.

For the general validation/error-rerender flow, see `form-error-handling-remix3`.

## Solution 1: Cross-field password confirmation

Validate individual fields with the schema, then compare after parse — both values are already validated individually:

```ts
let parsed = s.parseSafe(registerSchema, formData)
if (!parsed.success) {
  return context.render(<Page errors={issuesToFieldErrors(parsed.issues)} />, { status: 400 })
}
if (parsed.value.password !== parsed.value.confirmPassword) {
  return context.render(
    <Page error="Passwords do not match." errors={{ confirmPassword: 'Passwords do not match' }} />,
    { status: 400 },
  )
}
```

Reference: `app/actions/auth/controller.tsx:166` (`registerSchema`), `:198`/`:429` (mismatch checks).

## Solution 2: No `defaultValue` on password fields

When using `readFormFieldValues` + render-on-error, **exclude password fields** from both the form keys array and the input's `defaultValue`:

```ts
// Only non-sensitive fields — NEVER include password/confirmPassword
const FORM_KEYS = ['name', 'email'] as const
let formValues = readFormFieldValues(FORM_KEYS, formData)
```

```tsx
{/* Safe: name and email use defaultValue */}
<input name="name" defaultValue={formValues?.name ?? ''} />
<input name="email" defaultValue={formValues?.email ?? ''} />

{/* SECURITY: NO defaultValue on password fields */}
<input type="password" name="password" />
<input type="password" name="confirmPassword" />
```

## Solution 3: Password visibility toggle via `data-toggle-pw`

`PasswordToggle` in `app/ui/password-toggle.browser.tsx` renders a nonce'd `<script>` containing `PASSWORD_TOGGLE_SCRIPT` (`app/ui/password-toggle.script.ts`), so the listener is registered synchronously at parse time (no `import()` gap). See `remix3-server § Security` → `references/security-gotchas/security-checks.md`.

Server-render the button with `data-toggle-pw` pointing at the input's `name`; the script delegates at document level, so it survives frame swaps:

```tsx
<div mix={inputWrapperCss}>
  <input type="password" name="password" />
  <button type="button" data-toggle-pw="password" aria-label="Show password" mix={toggleButtonCss}>
    <Glyph name="eye" width={18} height={18} />
  </button>
</div>
```

Reference markup and styles: `app/actions/auth/pages.tsx:217-280` (`inputWrapperCss`, `inputHasToggleCss`, `toggleButtonCss`).

### Why the toggle is an inline script, not a `clientEntry`

- A `clientEntry` listener exists only after the async module import — clicks during hydration are lost.
- The shared script listens on `document`, so it serves every rendered form without a per-form mount.
- The markup + `data-toggle-pw` contract stays; only the registration mechanism changed.

The old "`clientEntry` must live in `app/assets/`" rationale is obsolete: this app's `remix.json` `assets.allowFiles` includes `app/ui/**` and other `app/ui/*.browser.tsx` entries ship from there.
