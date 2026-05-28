<!-- Context: development/remix3/route-pattern/guides/multi-matcher | Priority: high | Version: 1.0 | Updated: 2026-05-20 -->

# Multi Matcher — `createMultiMatcher`

Match many patterns against a URL with associated data, using **trie-based deterministic matching**. Returns the most specific match for a URL.

## Key Points

- **`.add(pattern, data)`**: Register a pattern with associated data (any type)
- **`.match(url)`**: Returns best (most specific) match or `null` — `{ params, data }`
- **`.matchAll(url)`**: Returns array of all matches sorted most→least specific
- **Type-safe data**: Generic type parameter `createMultiMatcher<T>()` types the data
- **Params NOT inferred**: Runtime patterns make type-level inference impractical

## Example

```ts
import { createMultiMatcher } from 'remix/route-pattern/match'
import { descending } from 'remix/route-pattern/specificity'

let matcher = createMultiMatcher<string>()
matcher.add('/', 'home')
matcher.add('blog/:slug', 'blog-post')
matcher.add('api(/v:version)/*path', 'api')

// Best match
let match = matcher.match('https://example.com/blog/v3')
// { params: { slug: 'v3' }, data: 'blog-post' }

// All matches sorted
let all = matcher.matchAll('https://example.com/api/v2/users/profile')
all.sort(descending) // Most → least specific
```

## Reference

- Source: `~/remix/packages/route-pattern/src/match.ts`
- Import: `remix/route-pattern/match`

## Related

- [Single Matcher](single-matcher.md) — For compile-time known patterns with type inference
- [Specificity Ranking](../concepts/specificity-ranking.md) — How matches are ranked
- [Pattern Syntax](../concepts/pattern-syntax.md) — Pattern language reference
