<!-- Context: development/remix3/guides/form-patterns | Priority: high | Version: 2.1 | Updated: 2026-05-13 -->

# Remix 3 Form Patterns

**Purpose**: CRUD forms with proper hydration in Remix 3 curried component pattern.

## Key Points

- **Edit forms**: Use `value={field}` (controlled) — props pass through hydration
- **Create forms**: Use `defaultValue` or omit (uncontrolled)
- **Textarea**: Use `defaultValue` or `value` — children are FORBIDDEN (type error)
- **Select elements**: Use `selected` prop on `<option>`, NOT `value` on `<select>` (SSR requirement)
- **Date fields**: `type="date"` for date-only; `type="datetime-local"` for time
- **Preserve pagination/sort** via `backUrl` when navigating to/from edit forms
- **Delete confirmation**: `data-confirm` attribute + global click handler
- **API redirects**: Add `redirect: 'none'` form field to prevent browser following 302s

## Minimal Example

```typescript
// Edit form (controlled)
<input name="username" value={user?.username ?? ''} />
<input type="checkbox" checked={user?.is_admin === 1} />

// Create form (uncontrolled)
<input name="username" defaultValue={''} />

// Preserving params
async edit({ params, url }) {
  let page = url.searchParams.get('page') ?? '1'
  return render(<FormPage backUrl={`?page=${page}&sort=${url.searchParams.get('sort')}`} />)
}
```

## Select/Dropdown Elements

**Problem**: `value` prop on `<select>` doesn't work in Remix SSR — browser falls back to first option.

**Cause**: HTML rendered server-side before JS runs. The `selected` attribute on `<option>` is the standard HTML approach.

**Correct Pattern**:
```tsx
// ✅ Use selected prop on options
<select>
  <option value="true" selected={currentValue === 'true'}>Yes</option>
  <option value="false" selected={currentValue === 'false'}>No</option>
</select>
```

**Reference**: `bookstore/app/ui/form/select-input.tsx`

## API Redirect Handling

**Problem**: API 302 redirects are followed by browser with same HTTP method (e.g., DELETE → 404).

**Solution**: Add `redirect: 'none'` to prevent server redirects:

```typescript
// Client
let formData = new FormData()
formData.set('bookId', String(bookId))
formData.set('redirect', 'none')
let res = await fetch(url, { method: 'DELETE', body: formData })
if (res.ok || res.status === 204) { window.location.reload() }

// Server
async remove({ get }) {
  let redirectTo = formData.get('redirect')
  if (redirectTo === 'none') { return new Response(null, { status: 204 }) }
  return redirect(routes.cart.index.href())
}
```

## Account Settings Form Pattern

```typescript
import * as s from 'remix/data-schema'
import * as f from 'remix/data-schema/form-data'
import { minLength } from 'remix/data-schema/checks'
import { number as coerceNumber } from 'remix/data-schema/coerce'

const accountSettingsSchema = f.object({
  name: f.field(s.defaulted(s.string(), '')),
  email: f.field(s.defaulted(s.string(), '')),
  password: f.field(s.defaulted(s.union([s.literal(''), s.string().pipe(minLength(8))]), '')),
  pagesize: f.field(s.defaulted(coerceNumber(), 20)),
})

async updateSettings({ get }) {
  let formData = get(FormData)
  let { email, name, password, pagesize } = s.parse(accountSettingsSchema, formData)
  // update DB...
  return new Response(null, { status: 302, headers: { Location: '/account' } })  // NOT Response.redirect()
}
```

**Key Points**: Use `s.parse(schema, formData)`. Use `new Response()` for redirects, not `Response.redirect()`. Use `coerceNumber()` for numeric inputs.

## RestfulForm for PUT/DELETE

HTML forms need PUT/DELETE semantics via hidden `_method` input:

```typescript
import { RestfulForm } from 'remix-ui'
<RestfulForm method="PUT" action="/items/1">
  <input name="title" value={item.title} />
  <button type="submit">Save</button>
</RestfulForm>
<RestfulForm method="DELETE" action="/items/1">
  <button type="submit">Delete</button>
</RestfulForm>
```

**Server**: Requires `methodOverride()` middleware: `createRouter({ middleware: [formData(), methodOverride()] })`.

**Reference**: `lookup/restful-patterns.md` — full RestfulForm reference. `checker/app/controllers/account/controller.tsx` — account settings implementation.
