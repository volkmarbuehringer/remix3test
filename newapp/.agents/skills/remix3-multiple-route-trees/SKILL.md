---
name: remix3-multiple-route-trees
description: "Understanding multiple named route exports composed via router.map() in Remix 3"
origin: auto-extracted
---

# Multiple Named Route Trees in Remix 3

**Extracted:** 2026-05-31
**Context:** When routes.ts exports multiple independent route trees (admin, ai, auth) that are composed separately in the router.

## Problem
`pnpm remix routes` shows far fewer routes than expected. The CLI only discovers the first route tree, missing admin, AI, auth, and other trees.

## Solution
Remix 3 supports multiple independent route trees via named exports:

```ts
// routes.ts — multiple named exports
export const routes = route({ home: '/', ... })
export const adminRoutes = route({ admin: route('admin', { ... }) })
export const aiRoutes = route({ ai: route('ai', { ... }) })
```

Each tree is mounted independently in `router.ts`:

```ts
router.map(routes, controller)
router.map(adminRoutes.admin, adminController)
router.map(aiRoutes.ai, aiController)
```

The CLI (`pnpm remix routes`) only sees the first/default export — it cannot discover independently mounted trees. All routes still work at runtime.

## When to Use
- You run `pnpm remix routes` and see fewer routes than expected
- You're adding a new route tree (admin, API, AI, etc.) alongside the main app
- You're debugging why a route works at runtime but isn't listed by the CLI
