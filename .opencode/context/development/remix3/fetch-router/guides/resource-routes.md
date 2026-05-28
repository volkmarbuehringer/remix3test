<!-- Context: development/remix3/fetch-router/guides/resource-routes | Priority: medium | Version: 1.0 -->

# Resource Routes — `resources()` and `resource()` Shorthands

Generate RESTful CRUD route maps for collections (`resources()`) and singletons (`resource()`). Each returns a typed object of `Route` instances.

## Key Points

- **`resources(name)`** (collection): `index`, `new`, `show`, `create`, `edit`, `update`, `destroy`.
  - Routes: `GET /name`, `GET /name/new`, `GET /name/:id`, `POST /name`, `GET /name/:id/edit`, `PUT /name/:id`, `DELETE /name/:id`.
  - `param` option: Custom param name, default `'id'`.
- **`resource(name)`** (singleton): `new`, `show`, `create`, `edit`, `update`, `destroy`.
  - Routes: `GET /name/new`, `GET /name`, `POST /name`, `GET /name/edit`, `PUT /name`, `DELETE /name`.
  - No `index` route — singletons have only one instance.
- **Options**: `only?: string[]` (include only), `exclude?: string[]` (exclude some), `names?: Record<string, string>` (custom key names).

## Example

```ts
import { resources, resource } from 'remix/routes'

let users = resources('users', { param: 'userId' })
// users.index   → GET  /users
// users.show    → GET  /users/:userId
// users.create  → POST /users
// users.destroy → DELETE /users/:userId

let profile = resource('profile', { only: ['show', 'edit', 'update'] })
// profile.show  → GET  /profile
// profile.edit  → GET  /profile/edit
// profile.update → PUT /profile
```

## Reference

- Source: `~/remix/packages/fetch-router/src/lib/route-helpers/resources.ts` and `resource.ts`
- Import: `import { resources, resource } from 'remix/routes'`

## Related

- [Form Routes](form-routes.md) — `form()` for simple GET+POST pairs
- [Controllers and Actions](controllers-and-actions.md) — Registering resource routes with controllers
- [Route Definitions](route-definitions.md) — Verb shorthand helpers
