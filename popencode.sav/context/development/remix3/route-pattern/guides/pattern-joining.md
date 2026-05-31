<!-- Context: development/remix3/route-pattern/guides/pattern-joining | Priority: high | Version: 1.0 | Updated: 2026-05-20 -->

# Pattern Joining — `joinPatterns`

Combine two patterns: origin parts (protocol, hostname, port) from `next` override `base`, pathnames concatenate with `/`, and search constraints merge by key.

## Key Points

- **Origin override**: Protocol, hostname, port from `next` replace `base`
- **Pathname concatenation**: Base pathname + `/` + next pathname — joined seamlessly
- **Search merge**: Search constraints merged by key — `next` keys override `base`
- **Returns `RoutePattern`**: Call `.toString()` for string form

## Example

```ts
import { joinPatterns } from 'remix/route-pattern/join'

// Simple path joining
joinPatterns('users', ':id').toString()
// '/users/:id'

// Origin override — next hostname replaces base
joinPatterns('api(/v:version)', '://remix.run/users/:id').toString()
// '://remix.run/api(/v:version)/users/:id'
```

## Reference

- Source: `~/remix/packages/route-pattern/src/join.ts`
- Import: `remix/route-pattern/join`

## Related

- [Parse & Stringify](../concepts/parse-stringify.md) — RoutePattern class
- [Pattern Syntax](../concepts/pattern-syntax.md) — Pattern language reference
- [Href Generation](href-generation.md) — Generate URLs from patterns
