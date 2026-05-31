<!-- Context: development/remix3/guides | Priority: medium | Version: 1.1 | Updated: 2026-04-02 -->

# SSE Project Git URL Setup - Standalone

**Purpose**: How to set up Remix 3 projects as standalone without pnpm workspace using git URLs.

## Key Points

- `remix` is a meta-package that re-exports from `remix/*` packages - all must be explicitly installed
- pnpm does NOT hoist transitive dependencies - must explicitly list all `remix/*` packages
- Git URL syntax: `github:remix-run/remix#preview/main&path:packages/<package>`
- TypeScript needs `.ts` extensions on local imports

## Complete Package List

```json
{
  "dependencies": {
    "remix/ui": "github:remix-run/remix#preview/main&path:packages/component",
    "remix/cookie": "github:remix-run/remix#preview/main&path:packages/cookie",
    "remix/headers": "github:remix-run/remix#preview/main&path:packages/headers",
    "remix/response": "github:remix-run/remix#preview/main&path:packages/response",
    "remix/session": "github:remix-run/remix#preview/main&path:packages/session",
    "remix": "github:remix-run/remix#preview/main&path:packages/remix"
    // ... plus ~15 more packages
  }
}
```

## Common Fixes

| Issue | Solution |
|-------|----------|
| Module has no exported member | Add missing `remix/*` package |
| Property on 'unknown' type | Add type assertion after `s.parse()` |
| Implicit 'any' type | File may be orphaned/not connected to router |

## Verification

```bash
pnpm install
pnpm run typecheck  # Should pass
```


**Related**: `guides/pagination.md`, `guides/design-system.md`