## Context

newapp uses two form validation patterns across 16 controllers:

```
                    parseSafe (8)     parse + try/catch (5)     parse - no handler (3)
                    ────────────     ─────────────────────     ─────────────────────
Pattern:            discriminated     try { parse() } catch {}  s.parse(data)  // unguarded
Error info:         per-field ✓       generic string only       crash / 500 ✗
Type safety:        narrowing ✓       cast with `as`            no narrowing
Timeboxer idiom:    yes ✓             no                        no
```

The `parseSafe` pattern is the canonical approach from timeboxer-demo and the Remix 3 skill reference. It uses `remix/data-schema`'s `parseSafe` which returns `{ success: true, value: T } | { success: false, issues: Array<{ message: string, path?: Array<unknown> }> }` — a discriminated union with structured errors.

## Goals / Non-Goals

**Goals:**

- Replace all `s.parse()` + `try/catch` in form validation context with `s.parseSafe()`
- Add proper error handling to 3 controllers currently using bare `s.parse()`
- Use `issuesToFieldErrors()` from `app/utils/schema-utils.ts` for all parseSafe call sites
- Upgrade 2 controllers already using parseSafe from generic to field-level errors

**Non-Goals:**

- Does NOT change schema definitions — only how they are invoked
- Does NOT change route handlers, middleware, or rendering pipeline
- Does NOT add new validation rules
- Does NOT extract non-form `s.parse()` calls (e.g., query param parsing in `lists-controller.tsx` lines 101-109, 133-137 — those parse route params, not form data)

## Decisions

### Refactoring pattern: minimal mechanical change

The transformation is mechanical and preserves behavior:

**Before (try/catch):**

```typescript
let email: string
try {
  ({ email } = s.parse(loginSchema, context.formData))
} catch {
  return context.render(<Page error="Generic error" />, { status: 400 })
}
```

**After (parseSafe):**

```typescript
let parsed = s.parseSafe(loginSchema, context.formData)
if (!parsed.success) {
  let fieldErrors = issuesToFieldErrors(parsed.issues)
  return context.render(<Page error="Generic error" errors={fieldErrors} />, { status: 400 })
}
let { email } = parsed.value
```

Key invariants preserved:

- Same context method used to access FormData (`context.formData` or `context.get(FormData)`)
- Same HTTP status codes on failure
- Same page component props API (add `errors` prop only where the page component already supports it)
- Schema definitions untouched

### Auth controllers: add `errors` prop to page components

`auth-login-controller.tsx` and `auth-register-controller.tsx` currently render `LoginPage(error={...})` and `RegisterPage(error={...})`. After switching to `parseSafe`, they will pass `errors={fieldErrors}` alongside `error`. The page components (`LoginPage`, `RegisterPage`) already use `AuthForm` which accepts an `errors` prop interface (the `AuthFormErrors` type, see `app/ui/auth-card.tsx`). The `AuthForm` component currently does NOT render field-level errors (they were removed during code review as dead code). This change will:

1. Switch parse to parseSafe in the controller
2. Pass `errors` to `AuthForm`
3. **Add field-level error rendering to AuthForm** — render `<span role="alert" mix={fieldErrorCss}>` below each field input when errors exist

### AuthForm: wire field-level errors

The `AuthForm` component in `app/ui/auth-card.tsx` currently accepts no `errors` prop (removed during code review cleanup). This change restores it with proper rendering:

```tsx
type AuthFormProps = {
  action: string
  children: RemixNode
  error?: string
  errors?: Record<string, string | undefined>
  footer?: RemixNode
  submitLabel: string
}
```

Each labeled input rendered as a child of `AuthForm` has a `name` attribute. The `AuthForm` cannot introspect children to append errors — instead, the field-level errors are passed as part of the `errors` prop and each controller's page component uses `errors?.fieldName` inline on individual `<input>` elements with `aria-describedby` and `aria-invalid`.

Actually — simpler approach: the page components render the field errors directly. `AuthForm` only renders the form-level error banner. Each controller's page renders:

```tsx
<label mix={fieldLabelCss}>
  <span>Email</span>
  <input name="email" aria-invalid={errors?.email ? true : undefined}
         aria-describedby={errors?.email ? 'email-error' : undefined}
         mix={[input.base, input.focus, errors?.email ? input.error : undefined]} />
  {errors?.email ? <span id="email-error" role="alert" css={...}>{errors.email}</span> : null}
</label>
```

This follows the timeboxer pattern exactly — `aria-invalid`, `aria-describedby`, and per-field error `<span>` elements.

### Admin-users controller: add field errors to admin page rendering

`admin-users-controller.tsx` currently uses try/catch and renders with a generic error message. The controller already renders pages that accept structured error data — the refactoring just switches the parse method and passes `fieldErrors` instead of a generic string.

### Lists controller: distinguish form from param parsing

`lists-controller.tsx` uses `s.parse()` in 4 places:

- L46: `s.parse(listsSaveSchema, formData)` — **form validation** (needs parseSafe)
- L79: `s.parse(s.number(), url.searchParams.get('page'))` — **query param** (keep s.parse)
- L102: `s.parse(listsSaveSchema, formData)` — **form validation** (needs parseSafe)
- L134: `s.parse(s.number(), url.searchParams.get('id'))` — **query param** (keep s.parse)

Only the form validation call sites (L46, L102) are refactored. The query param parsing (L79, L134) remains as `s.parse()` since those are internal parameter parsing, not user-facing form validation.

### Agent/chat/admin-messages: add parseSafe + error response

These three controllers currently have bare `s.parse()` with no error handler. They need:

```typescript
let parsed = s.parseSafe(messageSchema, context.formData)
if (!parsed.success) {
  return context.render(<Page error="Invalid input." />, { status: 400 })
}
let { message } = parsed.value
```

For `agent-controller.tsx` and `chat-controller.tsx`, the parse is inside a try/catch that handles _other_ errors (AI calls). The parseSafe check goes BEFORE the try block to keep validation separate from AI error handling.

### Error CSS: restore fieldErrorCss to auth-card.tsx

The `fieldErrorCss` was removed during code review cleanup. It needs to be re-added with the correct color token (`foreground`, not `background`):

```tsx
export const fieldErrorCss = css({
  color: theme.colors.action.danger.foreground,
  fontSize: theme.fontSize.xs,
})
```

## Risks / Trade-offs

**[Controller behavior change]** → parseSafe returns structured issues instead of throwing. The discriminated union pattern adds 3 lines per call site but makes the code clearer. No runtime behavior changes — the same schemas validate the same data, same status codes are returned.

**[AuthForm changes]** → Adding `errors` prop and field-level error rendering to `AuthForm` is a small feature addition to support the auth controllers. The `appointtype-controller.tsx` and `appointment-controller.tsx` controllers will also benefit from per-field errors instead of "Validation failed."

**[Agent/chat try/catch nesting]** → These controllers have existing try/catch for AI API calls. ParseSafe checks go above the try block — validation errors are handled before reaching AI logic. This is cleaner than letting `s.parse()` throw into the catch block.

## Open Questions

- Should the auth page components (`LoginPage`, `RegisterPage`) also render `value={formValues.field}` to preserve input on validation failure? This is a separate feature (timeboxer's render-on-error pattern) — out of scope for this change. The `errors` prop is the minimum needed to support parseSafe properly.
