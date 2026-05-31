---
title: Trie-Based Route Matching
category: concepts
type: context
source: /home/lucky/remix/decisions/005-trie-based-matching.md
tags: [remix3, concepts, design-decisions, routing, performance]
---

# Trie-Based Route Matching

## Core Concept
Remix 3 uses a single trie-based matcher for all route matching instead of offering array vs. trie options. Trie matching outperforms array matching in long-running servers and simplifies the API.

## Key Points
- Trie matcher vastly outperforms array matcher in "long-running server" benchmarks
- Array matcher only marginally faster (<2x) in cold-start lambda scenarios
- Eliminating array matcher prevents behavior drift between implementations
- Warm workers are more common than cold starts in practice
- Lambda providers like Cloudflare mitigate cold starts with TLS handshake optimizations

## Example
```ts
import { createMatcher } from 'remix/route-pattern'

const matcher = createMatcher()
matcher.add('/users/:id', { handler: userHandler })
const match = matcher.match('/users/123')
// { handler: userHandler, params: { id: '123' } }
```

## Reference
- [Remix Route Pattern Benchmarks](https://github.com/remix-run/remix/tree/main/packages/route-pattern/bench)
