---
title: "Remix 3 form validation: re-render from POST is the recommended pattern"
tags: [remix3, validation, forms, render, redirect, timeboxer, design]
created: 2026-06-02
status: active
---

## Problem

When designing form validation error handling, it's tempting to use redirects with URL params, session flash, or in-memory state tokens. But Remix 3 has an opinionated pattern that's simpler and avoids all of these.

## Solution

**Re-render from POST.** The controller returns `context.render(<Page values={formValues} errors={fieldErrors} />, { status: 400 })` directly from the action handler — no redirect.

The browser URL stays as the POST URL, so:
- Form state is naturally preserved (no encoding/decoding)
- No URL bloat (no `fv_`/`fe_` params)
- No type coercion bugs (no PostgreSQL number vs URL string mismatch)
- Single request (no POST → 302 → GET chain)
- Per-field errors pass as structured `Record<string, string>`

Source: `~/remix/demos/timeboxer/app/controllers/auth/controller.tsx:78-86`

```typescript
// ✅ Remix 3 recommended pattern (timeboxer demo)
let parsed = s.parseSafe(schema, context.get(FormData))
if (!parsed.success) {
  return render(
    <LoginPage errors={issuesToErrors(parsed.issues)} />,
    context.request,
    { status: 400 },
  )
}
```

```tsx
// Per-field error rendering in the page component
<input
  aria-invalid={errors?.username ? true : undefined}
  aria-describedby={errors?.username ? 'username-error' : undefined}
  name="username"
/>
{errors?.username ? (
  <small id="username-error" mix={fieldErrorStyle}>{errors.username}</small>
) : null}
```

## Why

- **Remix 3 demos consistently use this**: timeboxer, social-auth both re-render from POST. No demo uses redirects for validation errors.
- **No redirect means no data loss**: `FormData` is still available in the controller, no URL encoding needed.
- **Simplicity**: One function call (`render(...)`) replaces: build redirect URL → encode state → follow redirect → decode state → render.
- **`parseSafe` returns per-field issues**: Each issue has `{ message, path }` where `path[0]` is the field name. Map to `Record<string, string>` for the page.

## Trade-offs

- Browser URL stays as POST URL (e.g., `/admin/offerings` instead of `/admin/offerings?sort=...`)
- Refresh → "Confirm form resubmission" dialog (browser warns about re-POSTing)
- But Remix 3 auth demos accept this trade-off — it's standard for all server-rendered form apps

## Cross-reference

- Phase 1 implementation example: `openspec/changes/offerings-in-memory-token/design.md`
- Phase 2 (parseSafe + .refine()): `openspec/changes/offerings-in-memory-token/phase-2-parseSafe.md`
- `f.object` + `parseSafe` compatibility confirmed in `node_modules/remix/src/data-schema/README.md:74-94`
