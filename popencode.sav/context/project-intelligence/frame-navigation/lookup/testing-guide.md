# Testing Guide: frame-navigation

## Unit Tests

**Location:** `app/**/*.test.ts`

**Framework:** `remix/test` test runner

**Test Patterns:**
- Use `import { describe, it } from 'remix/test'`
- Use `import * as assert from 'remix/assert'`
- Import with `.js` extension: `import { users } from './schema.js'`

### Testing remix/data-table Schemas

```typescript
import { getTableValidator, getTableBeforeWrite, getTableAfterRead } from 'remix/data-table'

const usersValidate = getTableValidator(users)!
const usersBeforeWrite = getTableBeforeWrite(users)!
const usersAfterRead = getTableAfterRead(users)!
```

**Lifecycle hooks require specific context shapes:**
- `validate`: `{ operation: 'create', tableName: 'users', value: {...} }`
- `beforeWrite`: `{ operation: 'create', tableName: 'users', value: {...} }`
- `afterRead`: `{ tableName: 'users', value: {...} }` (no `operation` field)

**Type assertions needed:** Result types are unions, so cast when accessing `.value`:
```typescript
let result = usersBeforeWrite({...}) as { value: { name: string } }
```

### Running Tests

```bash
pnpm test
```

## E2E Tests

**Location:** `e2e/**/*.spec.ts`

**Framework:** Playwright

**Config:** `playwright.config.ts` (port 44100, chromium only)

### Running E2E Tests

```bash
pnpm test:e2e
```

### Test Patterns

- Login page redirects to `/account` after successful login (not `/`)
- Use `test.beforeEach` for auth setup
- Test theme toggle, navigation, form validation

### Auth Credentials (seeded)

- Admin: `admin@example.com` / `admin123`
- User: `user@example.com` / `user123`

## Lint & Typecheck

```bash
pnpm run lint    # oxlint
pnpm run typecheck  # tsc --noEmit
```