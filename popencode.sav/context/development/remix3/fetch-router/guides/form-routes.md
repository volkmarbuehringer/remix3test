<!-- Context: development/remix3/fetch-router/guides/form-routes | Priority: medium | Version: 1.0 -->

# Form Routes — `form()` Shorthand

Generate a GET index + POST action route pair for HTML form patterns. Perfect for the common "show form on GET, handle submission on POST" pattern.

## Key Points

- **`form(name)`**: Creates `{ index: Route<'GET', '/name'>, action: Route<'POST', '/name'> }`.
- **GET route** (`index`): Returns the form view (initial load).
- **POST route** (`action`): Handles form submission (validation, processing).
- **Same path**: Both routes share the same URL path (`/name`) — method alone determines which handler runs.
- **Typed `href()`**: `form('contact').action.href()` → `/contact`.

## Example

```ts
import { form } from 'remix/routes'

let contact = form('contact')
// {
//   index: Route<'GET', '/contact'>,
//   action: Route<'POST', '/contact'>,
// }

router.map(contact, {
  middleware: [session()],
  actions: {
    index(ctx) { return html(formView) },
    async action(ctx) {
      let data = await ctx.request.formData()
      return json({ ok: true })
    },
  },
})
```

## Reference

- Source: `~/remix/packages/fetch-router/src/lib/route-helpers/form.ts`
- Import: `import { form } from 'remix/routes'`

## Related

- [Resource Routes](resource-routes.md) — `resources()` and `resource()` for CRUD patterns
- [Route Definitions](route-definitions.md) — Verb shorthands and pattern objects
- [Controllers and Actions](controllers-and-actions.md) — Registering routes with `router.map()`
