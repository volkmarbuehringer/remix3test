<!-- Context: development/remix3/packages/concepts | Priority: high | Version: 1.0 | Updated: 2026-04-02 -->

# Concept: Route Pattern

**Purpose**: Type-safe URL matching and href generation. Supports path params, wildcards, optionals, full-URL patterns.

**Key Points**:
- Type-safe params inferred from patterns
- Variables: `:name` captures dynamic segments
- Wildcards: `*path` captures multi-segment paths
- Optionals: `(path)` makes parts optional
- Search params: `?key`, `?key=value` for query constraints
- Deterministic ranking: static > params > wildcards
- ArrayMatcher for ~80 routes, TrieMatcher for hundreds

**Minimal Example**:
```ts
import { RoutePattern, ArrayMatcher } from 'remix/route-pattern'

let blog = new RoutePattern('blog/:slug')
blog.match('https://remix.run/blog/v3') // { params: { slug: 'v3' } }
blog.href({ slug: 'v3' }) // '/blog/v3'

let matcher = new ArrayMatcher<string>()
matcher.add('/home', 'home')
matcher.add('blog/:slug', 'blog')
matcher.match('https://example.com/blog/v3') // { pattern: 'blog/:slug', data: 'blog' }
```

**Reference**: https://github.com/remix-run/remix/tree/main/packages/route-pattern