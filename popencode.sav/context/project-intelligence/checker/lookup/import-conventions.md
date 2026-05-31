<!-- Context: project-intelligence/checker/lookup/import-conventions | Priority: critical | Version: 1.1 | Updated: 2026-04-18 -->

# Import Conventions

> **CRITICAL**: This project uses `remix/*` imports, NOT `@remix-run/*`.

## The Rule

```typescript
// ✅ CORRECT - Always use remix/*
import { createCookie } from 'remix/cookie'
import { auth } from 'remix/auth-middleware'
import { Database } from 'remix/data-table'

// ❌ WRONG - Never use @remix-run/*
import { createCookie } from '@remix-run/cookie'
import { auth } from '@remix-run/auth-middleware'
```

## Complete Import Reference

| Package | Correct Import |
|---------|---------------|
| Cookie | `remix/cookie` |
| Session | `remix/session` |
| Session Middleware | `remix/session-middleware` |
| FS Session Storage | `remix/session/fs-storage` |
| Auth Middleware | `remix/auth-middleware` |
| Data Table | `remix/data-table` |
| Data Schema | `remix/data-schema` |
| Form Data Schema | `remix/data-schema/form-data` |
| Schema Checks | `remix/data-schema/checks` |
| Form Data Middleware | `remix/form-data-middleware` |
| Fetch Router | `remix/fetch-router` |
| Router Routes | `remix/fetch-router/routes` |
| Redirect | `remix/response/redirect` |
| Component | `remix/ui` |

## Common Patterns

**Middleware:**
```typescript
import { createCookie } from 'remix/cookie'
import { Session } from 'remix/session'
import { createFsSessionStorage } from 'remix/session/fs-storage'
import { auth, Auth, createSessionAuthScheme } from 'remix/auth-middleware'
import { Database } from 'remix/data-table'
```

**Controllers:**
```typescript
import type { Controller } from 'remix/fetch-router'
import { redirect } from 'remix/response/redirect'
import * as s from 'remix/data-schema'
import * as f from 'remix/data-schema/form-data'
import { minLength } from 'remix/data-schema/checks'
```

**UI:**
```typescript
import { css } from 'remix/ui'
```

## Why This Matters

The checker project uses a custom build that remaps imports. Using `@remix-run/*` will cause:
- Type errors
- Runtime failures
- Missing module errors

## 📂 Codebase References

**Examples:**
- `checker/app/middleware/session.ts` - Session imports
- `checker/app/middleware/auth.ts` - Auth middleware imports
- `checker/app/controllers/auth/login/controller.tsx` - Controller imports
- `checker/app/controllers/auth/login/page.tsx` - UI imports

## Related

- `guides/login-implementation.md` - Implementation guide
- `concepts/middleware-composition.md` - Middleware patterns
