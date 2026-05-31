<!-- Context: project-intelligence/newapp/lookup/data-schema-api | Priority: medium | Version: 1.0 | Updated: 2026-05-14 -->

# Lookup: data-schema API Quick Reference

Quick reference for `remix/data-schema` and `remix/data-schema/form-data` APIs used in newapp.

---

## Imports

```ts
import * as s from 'remix/data-schema'
import { email, minLength } from 'remix/data-schema/checks'
import * as f from 'remix/data-schema/form-data'
```

## Core Schema Types

| API | Purpose | Example |
|-----|---------|---------|
| `s.string()` | Validates input is a string | `s.string()` |
| `s.number()` | Coerces/validates number | `s.number()` |
| `s.defaulted(schema, fallback)` | Fallback if value is empty | `s.defaulted(s.string(), '')` |
| `schema.pipe(validator)` | Chains validator after base | `s.string().pipe(email())` |
| `s.parse(schema, input)` | Parses + validates | `s.parse(schema, formData)` |

Checks run left-to-right: `s.string().pipe(email())` → string check, then email format.

## Checks (`remix/data-schema/checks`)

| Check | Fails On | Example |
|-------|----------|---------|
| `email()` | Missing `@`, no domain | `s.string().pipe(email())` |
| `minLength(n)` | Shorter than n chars | `s.string().pipe(minLength(8))` |
| `maxLength(n)` | Longer than n chars | `s.string().pipe(maxLength(100))` |

## Form Data Bindings (`remix/data-schema/form-data`)

| API | Purpose | Example |
|-----|---------|---------|
| `f.object({...})` | Parses `FormData` into typed object | `f.object({ name: f.field(...) })` |
| `f.field(schema)` | Maps form field to schema | `f.field(s.defaulted(s.string(), ''))` |

`f.object()` reads fields via `formData.get(name)`. Missing fields get `null` → `defaulted()` fallback applies.

## Patterns in newapp

### Strict (register)
```ts
const registerSchema = f.object({
  name: f.field(s.string().pipe(minLength(1))),
  email: f.field(s.string().pipe(email())),
  password: f.field(s.string().pipe(minLength(8))),
})
```

### Guarded (login)
```ts
const loginSchema = f.object({
  email: f.field(s.defaulted(s.string(), '').pipe(email())),
  password: f.field(s.defaulted(s.string(), '')),
})
// Empty string from defaulted('') then fails pipe(email()) → throws
```

### Lenient (client CRUD)
```ts
const clientSaveSchema = f.object({
  name: f.field(s.defaulted(s.string(), '')),
  email: f.field(s.defaulted(s.string(), '')),
  // ... state preservation fields
  _offset: f.field(s.defaulted(s.string(), '')),
  _filter: f.field(s.defaulted(s.string(), '')),
})
```

## 📂 Codebase References

| File | Schema Pattern |
|------|---------------|
| `app/actions/auth-login-controller.tsx` | `defaulted().pipe(email())` — guarded |
| `app/actions/auth-register-controller.tsx` | `string().pipe(minLength(8))` — strict |
| `app/actions/client/controller.tsx` | `defaulted()` for all fields — lenient |

## Related

- [Form Ergonomics Concept](../concepts/form-ergonomics.md) — When to use each pattern
- [Controller Pattern](../guides/controller-pattern.md) — Schema parsing in actions
- [Frame CRUD Pattern](../guides/frame-crud-pattern.md) — CRUD save schema
