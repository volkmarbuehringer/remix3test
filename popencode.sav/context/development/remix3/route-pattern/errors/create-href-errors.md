<!-- Context: development/remix3/route-pattern/errors/create-href-errors | Priority: high | Version: 1.0 | Updated: 2026-05-20 -->

# CreateHrefError

`createHref` throws `CreateHrefError` when params are missing, hostname is absent for protocol patterns, or a nameless wildcard is used. Imported from `remix/route-pattern/href`.

## Error Types

| Type | `.details` | Cause |
|------|------------|-------|
| `missing-hostname` | `{ type: 'missing-hostname' }` | Pattern has protocol/port but no hostname |
| `missing-params` | `{ type: 'missing-params', missingParams: string[] }` | Required params not provided |
| `nameless-wildcard` | `{ type: 'nameless-wildcard' }` | Pattern uses `*` without a name |

## Example

```ts
import { createHref, CreateHrefError } from 'remix/route-pattern/href'

try {
  createHref('http://:region.cdn.com/*', { region: 'us-west' })
} catch (error) {
  if (error instanceof CreateHrefError) {
    switch (error.details.type) {
      case 'missing-hostname':
        console.error('Hostname required with protocol')
        break
      case 'missing-params':
        console.error('Missing:', error.details.missingParams)
        break
      case 'nameless-wildcard':
        console.error('Wildcard needs a name')
        break
    }
  }
}
```

## Reference

- Source: `~/remix/packages/route-pattern/src/href.ts`
- Import: `remix/route-pattern/href`

## Related

- [Href Generation guide](../guides/href-generation.md) — Using createHref
- [Pattern Syntax](../concepts/pattern-syntax.md) — Nameless wildcards in patterns
