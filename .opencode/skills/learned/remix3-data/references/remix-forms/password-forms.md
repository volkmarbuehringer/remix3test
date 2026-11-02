# Password Form Patterns

## What This Covers

The three password-specific concerns that standard form error handling doesn't cover:

1. **Cross-field validation** — `minLength(8)` checks one field; `password === confirmPassword` needs a post-parse check.
2. **Security leak via `defaultValue`** — preserving submitted values with `defaultValue` on a password input exposes the plaintext password in the HTML source, even though the browser masks it as dots.
3. **Password visibility toggle** — no built-in toggle; putting the `clientEntry` in `app/ui/` breaks the client bundle.

For the general validation/error-rerender flow, see `form-error-handling-remix3`.

## Solution 1: Cross-field password confirmation

Validate individual fields with the schema, then add a post-parse check for matching passwords:

```typescript
import * as s from 'remix/data-schema'
import { minLength } from 'remix/data-schema/checks'
import * as f from 'remix/data-schema/form-data'

const registerSchema = f.object({
  name: f.field(s.string().pipe(minLength(1))),
  email: f.field(s.string().pipe(email())),
  password: f.field(s.string().pipe(minLength(8))),
  confirmPassword: f.field(s.string().pipe(minLength(1))),
})

// In the action handler:
let parsed = s.parseSafe(registerSchema, formData)
if (!parsed.success) {
  return context.render(
    <Page errors={issuesToFieldErrors(parsed.issues)} />,
    { status: 400 },
  )
}

// Cross-field check AFTER schema parse — both fields validated individually
if (parsed.value.password !== parsed.value.confirmPassword) {
  return context.render(
    <Page error="Passwords do not match." errors={{ confirmPassword: 'Passwords do not match' }} />,
    { status: 400 },
  )
}
```

## Solution 2: Security — no `defaultValue` on password fields

When using the standard `readFormFieldValues` + render-on-error pattern, **exclude password fields** from both the form keys array and the input's `defaultValue`:

```typescript
// Only non-sensitive fields — NEVER include password/confirmPassword
const FORM_KEYS = ['name', 'email'] as const

let formValues = readFormFieldValues(FORM_KEYS, formData)
let parsed = s.parseSafe(registerSchema, formData)
if (!parsed.success) {
  return context.render(
    <Page errors={issuesToFieldErrors(parsed.issues)} formValues={formValues} />,
    { status: 400 },
  )
}
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

> **Current app pattern (re-checked 2026-10-24):** no `clientEntry`. `PasswordToggle` in `app/ui/password-toggle.browser.tsx` renders a nonce'd `<script>` containing `PASSWORD_TOGGLE_SCRIPT` (`app/ui/password-toggle.script.ts`), so the listener is registered synchronously at parse time (no `import()` gap). See `remix3-server § Security` → `references/security-gotchas/csp-inline-scripts.md`.

Server-render the toggle button with `data-toggle-pw` pointing at the input's `name`; the script delegates at document level, so it survives frame swaps:

```tsx
<div mix={inputWrapperCss}>
  <input type="password" name="password" />
  <button type="button" data-toggle-pw="password" aria-label="Show password" mix={toggleButtonCss}>
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  </button>
</div>
```

### CSS for toggle button positioning

```typescript
import { css } from 'remix/component'
import { theme } from 'app/ui/theme/theme.ts'

export const inputWrapperCss = css({
  position: 'relative',
  display: 'flex',
  alignItems: 'center',
})

export const inputHasToggleCss = css({
  paddingRight: '2.25rem',
})

export const toggleButtonCss = css({
  position: 'absolute',
  right: '0.25rem',
  top: '50%',
  transform: 'translateY(-50%)',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '2rem',
  height: '2rem',
  padding: 0,
  border: 'none',
  borderRadius: theme.radius.sm,
  background: 'transparent',
  color: theme.colors.text.muted,
  cursor: 'pointer',
  '&:hover': {
    color: theme.colors.text.primary,
    background: theme.surface.lvl1,
  },
  '&:focus-visible': {
    outline: `2px solid ${theme.colors.action.primary.background}`,
    outlineOffset: -2,
  },
})
```

### Why the toggle is an inline script, not a `clientEntry`

- Wrapped in `clientEntry`, the listener exists only after the async module import — clicks during hydration are lost.
- The shared script listens on `document`, so it serves every rendered form without a per-form mount.
- The markup + `data-toggle-pw` contract stays; only the registration mechanism changed.

The old "`clientEntry` must live in `app/assets/`" rationale is obsolete: this app's `remix.json` `assets.allowFiles` includes `app/ui/**` and other `app/ui/*.browser.tsx` entries ship from there.
