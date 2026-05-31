<!-- Context: development/remix3/lookup/typescriptissues | Priority: medium | Version: 1.1 | Updated: 2026-04-12 -->

# TypeScript Resolution Issues

pnpm workspace + module resolution problems in Remix 3.

## Problem

```
Module '"remix/fetch-router"' has no exported member 'Controller'
```

Types exist in source but not resolved in extracted projects.

---

## Root Causes

1. **pnpm workspaces**: Hoisted dependencies vs nested node_modules
2. **Package exports**: `package.json` subpaths may not resolve
3. **TypeScript paths**: Aliases may not match after extraction

---

## Solutions

1. **Check package.json exports**:
```json
{
  "exports": {
    "./fetch-router": "./src/fetch-router.ts"
  }
}
```

2. **Use explicit imports**: `import type { Controller } from 'remix/fetch-router'`

3. **Rebuild types**: `pnpm run build` or `pnpm run typecheck`

4. **Check tsconfig**: Verify `paths` and `baseUrl` settings

---

## Reference

- pnpm docs: https://pnpm.io/workspaces
- TypeScript paths: https://www.typescriptlang.org/docs/handbook/module-resolution.html
