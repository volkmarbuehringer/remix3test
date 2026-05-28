<!-- Context: development/remix3/route-pattern/concepts/pattern-syntax | Priority: high | Version: 1.0 | Updated: 2026-05-20 -->

# Pattern Syntax

Route pattern syntax supports path variables, wildcards, optionals, search constraints, and full-URL patterns (protocol, hostname, port).

## Key Points

- **Variables** (`:name`): Capture a single path segment — `'users/:id'` matches `/users/123`
- **Wildcards** (`*name`): Match multi-segment paths — `'files/*path'` matches `/files/images/logo.png`
- **Optionals** (`()`): Make parts optional — `'api(/v:version)/users'` matches `/api/users` or `/api/v2/users`
- **Search constraints**: `'search?q'` (key present), `'search?q=routing'` (key=value exact match)
- **Full URLs**: `'http(s)://:region.cdn.com/assets/*file.:ext'` — protocol, hostname, port all supported
- **Sequential variables**: `'blog/:year-:month-:day/:slug'` — variables can be adjacent
- **Nested optionals**: `'api(/v:major(.:minor))'` — optionals nest for complex structures

## Minimal Example

```ts
import { createMatcher } from 'remix/route-pattern/match'

let m = createMatcher('blog/:year-:month-:day/:slug')
m.match('/blog/2026-05-20/hello')?.params
// { year: '2026', month: '05', day: '20', slug: 'hello' }
```

## Reference

- Source: `~/remix/packages/route-pattern/README.md`
- Import: `remix/route-pattern`

## Related

- [Parse & Stringify](parse-stringify.md) — RoutePattern class
- [Specificity Ranking](specificity-ranking.md) — How patterns are ranked
- [Single Matcher guide](../guides/single-matcher.md) — Type-safe matching
