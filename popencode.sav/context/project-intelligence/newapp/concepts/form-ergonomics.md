<!-- Context: project-intelligence/newapp/concepts/form-ergonomics | Priority: high | Version: 1.0 | Updated: 2026-05-14 -->

# Concept: Form Ergonomics

**Core Idea**: Three complementary layers — `RestfulForm`, `methodOverride()`, and `data-schema` — together enable RESTful HTML forms with server-side validation.

---

## The Stack

```
RestfulForm (UI)          — Renders <form> with hidden _method for PUT/DELETE
methodOverride (Router)   — Reads _method from formData, rewrites request method
data-schema (Validation)  — Parses & validates formData with email/minLength/defaulted
```

Each layer is independent but designed to work together.

---

## Layer 1: RestfulForm

Wraps native `<form>` to emit PUT/DELETE/PATCH (HTML forms only support GET/POST natively):

```tsx
import { RestfulForm } from '../../ui/restful-form.tsx'

// Renders: <form method="POST" action="/client/42">
//          <input type="hidden" name="_method" value="PUT" />
<RestfulForm method="PUT" action={`/client/${row.id}`}>
  <input name="email" value={row.email} />
  <Button type="submit">Save</Button>
</RestfulForm>
```

Rules: `GET` → native `<form method="GET">`. `POST` → native `<form method="POST">`. `PUT|DELETE|PATCH` → `<form method="POST">` + hidden `_method` input. Default field name: `_method`. Customize via `methodOverrideField` prop.

## Layer 2: methodOverride Middleware

Registered in the router stack **after** `formData()`. Reads `_method` from parsed formData and rewrites `request.method` before routing.

```ts
formData(),       // parses body first
methodOverride(), // rewrites method based on _method field
```

Only affects POST requests with a `_method` field. Safe alongside regular POST forms.

## Layer 3: data-schema Validation

Server-side parsing using `remix/data-schema` with form-data bindings from `remix/data-schema/form-data`.

Three patterns exist in newapp:

| Pattern | Example | Behavior |
|---------|---------|----------|
| **Strict** | Register form | All required, no defaults. `s.parse()` throws on invalid input |
| **Guarded** | Login form | Validates email format before credentials check — fails fast |
| **Lenient** | Client CRUD | All fields `defaulted()`, returns object even with partial input |

### Parsing in Actions

```ts
// Strict — destructure typed result
let { name, email, password } = s.parse(registerSchema, formData)

// Lenient — wrapped in try/catch
try {
  parsed = s.parse(clientSaveSchema, formData)
} catch {
  return Response.json({ error: 'Invalid form data' }, { status: 400 })
}

// Guarded — validate before auth
try { s.parse(loginSchema, context.formData) } catch {
  return render(<LoginPage error="Invalid format." />, { status: 400 })
}
let user = await verifyCredentials(passwordProvider, context)
```

---

## 📂 Codebase References

- **RestfulForm component**: `app/ui/restful-form.tsx` — `<form>` wrapper
- **methodOverride middleware**: `app/router.ts` — In router stack
- **Login validation**: `app/actions/auth-login-controller.tsx` — `email()` + guarded pattern
- **Register validation**: `app/actions/auth-register-controller.tsx` — `minLength(8)` + strict
- **Client CRUD validation**: `app/actions/client/controller.tsx` — `defaulted()` + lenient
- **RestfulForm usage (edit)**: `app/actions/client/edit-page.tsx` — `method="PUT"`
- **RestfulForm usage (create)**: `app/actions/client/create-page.tsx` — `method="POST"`

## Related

- [data-schema API Reference](../lookup/data-schema-api.md) — All available validators
- [Middleware Chain](./middleware-chain.md) — Where methodOverride sits in stack
- [Frame CRUD Pattern](../guides/frame-crud-pattern.md) — RestfulForm in CRUD grid
- [Controller Pattern](../guides/controller-pattern.md) — Schema parsing in actions
