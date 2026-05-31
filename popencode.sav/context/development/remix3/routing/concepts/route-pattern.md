# Route Pattern

Type-safe URL matching and href generation. Supports path params, wildcards, optionals, full URLs, and deterministic ranking.

## Key Points

- **Type-Safe Params**: Infer parameter types from patterns for compile-time route correctness
- **Flexible Syntax**: `:name` params, `*name` wildcards, `(...)` optionals, `?key` search param constraints
- **Full URL Support**: Match protocol, host, pathname, and search params
- **Matcher**: `createMatcher<T>()` — register multiple patterns with associated data, highest specificity wins
- **Deterministic Ranking**: Static segments > params > wildcards; more search params = more specific

## Quick Example

```ts
import { RoutePattern, createMatcher } from 'remix/route-pattern'

let blog = new RoutePattern('blog/:slug')
blog.match('https://example.com/blog/v3') // { params: { slug: 'v3' } }
blog.href({ slug: 'v3' }) // '/blog/v3'

// Multi-pattern matcher
let matcher = createMatcher<string>()
matcher.add('blog/hello', 'static-page')
matcher.add('blog/:slug', 'dynamic-page')

matcher.match('https://example.com/blog/hello')
// { pattern: 'blog/hello', data: 'static-page' } (static wins over param)
```

## Reference

- Full docs: `~/remix/packages/route-pattern/README.md`
- Import: `remix/route-pattern`

## Related

- [routing concept](./routing.md) — fetch-router uses route-pattern internally
- [asset-server concept](../../ui/concepts/asset-server.md) — fileMap uses route-pattern syntax
