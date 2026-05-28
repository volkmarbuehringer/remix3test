---
title: RoutePattern vs. URLPattern
category: concepts
type: context
source: /home/lucky/remix/decisions/001-route-pattern-vs-url-pattern.md
tags: [remix3, concepts, design-decisions, routing]
---

# RoutePattern vs. URLPattern

## Core Concept
Remix 3 uses a custom `RoutePattern` instead of the built-in `URLPattern` for URL matching. `RoutePattern` provides better developer experience with easier pathname-only matching, non-exhaustive search, and intuitive optional syntax.

## Key Points
- Includes built-in URL generation via "href builder" for route patterns
- Supports non-exhaustive search matching (ignores extra query params)
- Uses parenthetical optional syntax (`(/:id)`) for clearer intent than regex `?`
- All parameters must be named, no unnamed regex groups
- No regex syntax allowed, making patterns statically analyzable

## Example
```ts
import { RoutePattern } from 'remix/route-pattern'

// Pathname-only matching without object syntax
const pattern = new RoutePattern('products/:id')

// Non-exhaustive search matching
pattern.match('https://remix.run/?q=remix&utm_source') // matches!

// Intuitive optional groups
const optionalPattern = new RoutePattern('/books(/:id)')
```

## Reference
- [URLPattern MDN Docs](https://developer.mozilla.org/en-US/docs/Web/API/URLPattern)
- [Remix RoutePattern Source](https://github.com/remix-run/remix/tree/main/packages/route-pattern)
