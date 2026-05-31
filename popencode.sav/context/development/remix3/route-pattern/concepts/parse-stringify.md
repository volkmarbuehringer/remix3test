<!-- Context: development/remix3/route-pattern/concepts/parse-stringify | Priority: high | Version: 1.0 | Updated: 2026-05-20 -->

# Parse & Stringify

`RoutePattern` parses pattern strings into structured parts and serializes back. Use for high-performance scenarios — parse once, match many times.

## Key Points

- **`RoutePattern.parse(str)`**: Parses a pattern string into a `RoutePattern` instance
- **`::toString()` / `::source`**: Returns the pattern string
- **`::toJSON()`**: Returns structured parts `{ protocol?, hostname?, port?, pathname, search }`
- **`new RoutePattern(parsed)`**: Construct from parsed parts (matching `toJSON()` shape)

## Minimal Example

```ts
import { RoutePattern } from 'remix/route-pattern'

let pattern = RoutePattern.parse('://example.com/blog/:slug')
pattern.toString()           // '://example.com/blog/:slug'
pattern.toJSON()             // { hostname: 'example.com', pathname: { ... }, ... }

// Construct from parts
let p2 = new RoutePattern(pattern.toJSON())
```

## Reference

- Source: `~/remix/packages/route-pattern/README.md`
- All APIs accepting `pattern` accept `string | RoutePattern`

## Related

- [Pattern Syntax](pattern-syntax.md) — Pattern language reference
- [Specificity Ranking](specificity-ranking.md) — Ranking rules for patterns
