# Data Schema

Tiny, standards-aligned data validation library. Standard Schema v1 compatible, sync-first, runs anywhere.

## Key Points

- **Standard Schema v1**: Works with Zod, Valibot, ArkType schemas too
- **Sync-First**: `parse()` returns typed value or throws; `parseSafe()` branches on `.success`
- **FormData/URLSearchParams**: `remix/data-schema/form-data` helpers for form/query validation
- **Composable**: Primitives, objects, unions, variants, lazy, pipes, refinements, transforms

## Quick Example

```ts
import { object, string, number, parse } from 'remix/data-schema'
import { email, minLength, min } from 'remix/data-schema/checks'
import * as coerce from 'remix/data-schema/coerce'

let User = object({
  id: string(),
  email: string().pipe(email()),
  age: coerce.number().pipe(min(13)),
  role: string(),
})

let user = parse(User, {
  id: 'u1',
  email: 'ada@example.com',
  age: '37',    // coerced from string
  role: 'admin',
})
```

## Reference

- Full docs: `~/remix/packages/data-schema/README.md`
- Imports: `remix/data-schema`, `remix/data-schema/checks`, `remix/data-schema/coerce`, `remix/data-schema/form-data`, `remix/data-schema/lazy`

## Related

- [form-data-parser](./form-data-parser.md) — Binary uploads paired with schema validation
- [form-data-middleware guide](../guides/form-data-handling.md)
- [form patterns guide](../../guides/form-patterns.md)
