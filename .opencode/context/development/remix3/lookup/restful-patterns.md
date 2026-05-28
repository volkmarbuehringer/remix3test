<!-- Context: development/remix3/lookup/restful-patterns | Priority: high | Version: 1.0 | Updated: 2026-03-25 -->

# Lookup: RESTful Form Patterns

**Purpose**: Quick reference for using RestfulForm with method override

## RestfulForm Component

Wrapper around `<form>` that adds hidden `_method` input for PUT/DELETE via POST.

```typescript
import { RestfulForm } from 'remix-ui'

// PUT request (becomes POST with _method=PUT)
<RestfulForm method="PUT" action="/items/1">
  <input name="title" value="Updated" />
  <button type="submit">Save</button>
</RestfulForm>

// DELETE request
<RestfulForm method="DELETE" action="/items/1">
  <button type="submit">Delete</button>
</RestfulForm>
```

## Method Override Middleware

Required in router for PUT/DELETE to work:

```typescript
import { methodOverride } from 'remix/method-override-middleware'

let router = createRouter({
  middleware: [formData(), methodOverride()],
})
```

## Key Points

- Form renders as `<form method="POST">` with hidden `<input name="_method" value="PUT">`
- Middleware reads `_method` and uses it for route matching
- Enables RESTful PUT/DELETE without JS or fetch
- Custom field name via `methodOverrideField` prop

## Reference

- packages/method-override-middleware/README.md
- demos/bookstore/app/ui/restful-form.tsx
