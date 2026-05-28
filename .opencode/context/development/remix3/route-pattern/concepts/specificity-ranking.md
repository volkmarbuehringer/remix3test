<!-- Context: development/remix3/route-pattern/concepts/specificity-ranking | Priority: high | Version: 1.0 | Updated: 2026-05-20 -->

# Specificity Ranking

Deterministic left-to-right ranking: static characters beat variables (`:name`), which beat wildcards (`*name`). The earliest difference between two patterns decides the winner.

## Key Points

- **Static > Variable > Wildcard**: At the earliest position where patterns differ, static chars win over `:name`, which wins over `*name`
- **Search constraints**: key+value > key-only > none — more specific search constraints rank higher
- **Deterministic**: No ambiguity — ranking is fully predictable from pattern structure
- **Functions**: `descending`, `ascending`, `compare`, `lessThan`, `greaterThan`, `equal` — imported from `remix/route-pattern/specificity`

## Minimal Example

```ts
import { descending } from 'remix/route-pattern/specificity'

let matcher = createMultiMatcher<string>()
matcher.add('/', 'home')
matcher.add('blog/:slug', 'blog-post')

let matches = matcher.matchAll(url)
matches.sort(descending) // Most → least specific
```

## Reference

- Source: `~/remix/packages/route-pattern/specificity.ts`
- Import: `remix/route-pattern/specificity`

## Related

- [Multi Matcher guide](../guides/multi-matcher.md) — Sorting matches by specificity
- [Pattern Syntax](pattern-syntax.md) — Pattern language reference
