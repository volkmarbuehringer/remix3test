<!-- Context: development/remix3/guides | Priority: high | Version: 1.4 | Updated: 2026-04-07 -->

# Lint Rules & Code Style

**Purpose**: Document lint rules (oxlint) enforced in Remix 3 projects and patterns to follow.

## Key Points

- **Run before finishing**: `pnpm run typecheck` (0 errors), `pnpm run lint` (0 errors, warnings OK)
- **Module scope**: Use `const` for bindings never reassigned
- **Local scope**: Use `let` for function-local variables (distinguishes from module scope)
- **Never use var**: Use `let` or `const`
- **Import extensions**: TypeScript requires `.js` or `.ts` on local imports
- **Empty catch**: Omit error parameter when unused
- **Unused vars**: Prefix with `_` or remove

### E2E Tests

This rule applies to E2E tests (Playwright). Test callbacks are local scope, not module scope, so use `let` for local variables inside tests:

```typescript
// CORRECT - let for local bindings in tests
test('my test', async ({ page }) => {
  let select = page.locator('select[name="foo"]')
  let options = select.locator('option')
})
```

Reference: `guides/e2e-testing.md`

## Quick Reference

| Rule | Pattern | Fix |
|------|---------|-----|
| prefer-const-module-scope | Module-level vars | Use `const` |
| prefer-let-locals | Function-local vars | Use `let` |
| no-var | Any variable | Use `let` or `const` |
| no-unused-vars | Unused code | Remove or `_` prefix |
| import/extensions | Local imports | Add `.ts` extension |

## Minimal Example

```javascript
// ✅ Module scope - const
const sessionStorage = createCookieSessionStorage();
const PUBLIC_ROUTES = ['/login', '/health'];

// ✅ Local scope - let
function processMessages() {
  let count = 0;
  for (let msg of messages) {
    let sender = findUser(msg.sender_id);
  }
}

// ✅ Imports with extensions
import { getUser } from './db.ts'
import { authCookie } from './auth/session.ts'

// ✅ Empty catch
try { controller.close(); } catch { /* ignore */ }
```


**Related**: `../../../core/standards/concepts/code-quality.md`, `../data/guides/input-validation.md`