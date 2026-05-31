<!-- Context: development/remix3/route-pattern/guides/href-generation | Priority: high | Version: 1.0 | Updated: 2026-05-20 -->

# Href Generation — `createHref`

Generate URLs from a pattern + params with **type-safe parameter enforcement**. Throws `CreateHrefError` for missing params.

## Key Points

- **Required params**: All non-optional `:name` params must be provided or it throws
- **Optional groups**: Groups without params are **included** — `'todos(/new)'` produces `/todos/new`
- **Search params**: Third arg sets search params — merged with pattern's search constraints
- **Full URLs**: Generates protocol + hostname when pattern includes them

## Example

```ts
import { createHref } from 'remix/route-pattern/href'

// Basic path params
createHref('blog/:slug', { slug: 'v3' })
// '/blog/v3'

// Optional groups + wildcards
createHref('api(/v:version)/*path', { version: '2', path: 'users/profile' })
// '/api/v2/users/profile'

// Full URL with protocol alternatives
createHref('http(s)://:region.cdn.com/assets/*file.:ext', {
  region: 'us-west', file: 'images/logo', ext: 'png'
})
// 'https://us-west.cdn.com/assets/images/logo.png'

// Search params
createHref('blog/:slug?ref=docs', { slug: 'v3' }, { utm_source: 'newsletter' })
// '/blog/v3?utm_source=newsletter&ref=docs'

// Optional groups included when no params needed
createHref('todos(/new)') // '/todos/new'
```

## Reference

- Source: `~/remix/packages/route-pattern/src/href.ts`
- Import: `remix/route-pattern/href`
- Errors: See [CreateHrefError](../errors/create-href-errors.md) for error types

## Related

- [Pattern Syntax](../concepts/pattern-syntax.md) — Pattern language reference
- [CreateHrefError types](../errors/create-href-errors.md) — Error handling
