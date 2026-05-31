<!-- Context: development/remix3/packages/concepts | Priority: medium | Version: 1.1 | Updated: 2026-05-20 -->

# Concept: Method Override Middleware

**Purpose**: Method override middleware. Allows HTML forms to simulate PUT, PATCH, and DELETE requests using a hidden form field.

**Key Points**:
- Translates posted form fields into request methods
- Updates `context.method` with the override value
- Supports REST-style routes from standard browser forms
- Configurable field name via `fieldName` option (default: `_method`)
- Must run AFTER formData middleware

**Minimal Example**:
```ts
import { formData } from 'remix/middleware/form-data'
import { methodOverride } from 'remix/middleware/method-override'

let router = createRouter({
  middleware: [formData(), methodOverride()],
})

router.delete('/users/:id', async (context) => {
  let userId = context.params.id
  await deleteUser(userId)
  return new Response('User deleted')
})
```

**Custom Field Name**:
```ts
methodOverride({ fieldName: '__method__' })
```

HTML form:
```html
<form method="POST" action="/users/123">
  <input type="hidden" name="__method__" value="PUT" />
  <button type="submit">Update User</button>
</form>
```

**Reference**: https://github.com/remix-run/remix/tree/main/packages/method-override-middleware
