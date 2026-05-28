<!-- Context: development/remix3/packages/core | Priority: high | Version: 1.0 | Updated: 2026-04-25 -->

# route-pattern

Type-safe route pattern matching with parameter inference.

## Core Idea

Pattern matching library that powers `fetch-router`. Converts route strings like `/blog/:slug` into typed matchers with inferred param types.

## Key Points

- **Parameter Extraction**: `/users/:id` extracts `id` param
- **Type Inference**: Param types inferred from pattern syntax
- **Wildcards**: `*` for catch-all segments
- **Modifiers**: `?` for optional, `+` for repeating
- **Query Parsing**: Extracts search params from URLs

## Quick Example

```ts
import { match, compile } from 'route-pattern'

let pattern = match('/blog/:slug')

pattern.match('/blog/hello') 
// → { params: { slug: 'hello' }, type: 'match' }

pattern.match('/blog/hello?page=2')
// → { params: { slug: 'hello' }, search: { page: '2' }, type: 'match' }

pattern.match('/users/123')
// → { type: 'miss' }

// Compile pattern to string
let url = compile('/users/:id', { id: '123' })
// → '/users/123'
```

## Reference

`/home/lucky/remix/packages/route-pattern/README.md`