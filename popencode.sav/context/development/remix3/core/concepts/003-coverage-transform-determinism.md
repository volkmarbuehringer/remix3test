---
title: Coverage Transform Determinism
category: concepts
type: context
source: /home/lucky/remix/decisions/003-coverage-transform-determinism.md
tags: [remix3, concepts, design-decisions, testing, coverage]
---

# Coverage Transform Determinism

## Core Concept
Remix's test coverage requires deterministic TypeScript-to-JavaScript transforms across load-time and collection-time. Using the same `transformTypeScript` function ensures V8 coverage byte offsets align with re-derived JS.

## Key Points
- V8 records byte offsets in executed JS, not source line numbers
- `v8-to-istanbul` needs exact JS bytes to map coverage to original sources
- Load-time (Node loader) and collection-time (coverage converter) must use identical transforms
- esbuild is pinned for deterministic output with inline source maps
- oxc-transform caused coverage failures due to different formatting and missing source map mappings

## Example
```ts
// lib/ts-transform.ts - single source of truth
export function transformTypeScript(source: string, filePath: string) {
  return esbuild.transformSync(source, {
    loader: 'ts',
    sourcemap: 'inline',
    sourcesContent: true,
  })
}
```

## Reference
- [Remix Test Coverage Parity Test](https://github.com/remix-run/remix/blob/main/packages/test/src/test/coverage-parity.test.ts)
