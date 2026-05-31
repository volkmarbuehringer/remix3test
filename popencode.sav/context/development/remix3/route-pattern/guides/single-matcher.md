<!-- Context: development/remix3/route-pattern/guides/single-matcher | Priority: high | Version: 1.0 | Updated: 2026-05-20 -->

# Single Matcher — `createMatcher`

Match a single pattern against a URL with **inferred type-safe params**. Best for one-off routing or when you know the exact pattern at compile time.

## Key Points

- **Type inference**: Params type is inferred from the pattern string — no manual typing
- **`.match(url)`**: Returns `{ params }` or `null` when URL doesn't match
- **`ignoreCase` option**: Pathname case-insensitivity (hostname always case-insensitive)
- **Accepts `string | RoutePattern`**: Pre-parse with `RoutePattern.parse()` for repeated matching

## Example

```ts
import { createMatcher } from 'remix/route-pattern/match'

let matcher = createMatcher('blog/:slug')

// Match against a full URL
let match = matcher.match('https://example.com/blog/v3')
match?.params // { slug: 'v3' } — type-safe!

// No match returns null
let noMatch = matcher.match('https://example.com/about')
noMatch // null
```

## Reference

- Source: `~/remix/packages/route-pattern/src/match.ts`
- Import: `remix/route-pattern/match`

## Related

- [Multi Matcher](multi-matcher.md) — Match many patterns with associated data
- [Pattern Syntax](../concepts/pattern-syntax.md) — Pattern language reference
- [Parse & Stringify](../concepts/parse-stringify.md) — Pre-parse patterns for performance
