<!-- Context: project-intelligence/my_app/controller-fix | Priority: high | Version: 1.0 | Updated: 2026-05-01 -->

# Guide: Fixing remix doctor Controller Warnings

## Problem
Running `remix doctor` warns that controller files are in the wrong location. This happens when the directory structure doesn't match the convention enforced by `remix doctor --fix`.

## Root Cause
The `remix doctor` validator uses `toDiskSegment()` to derive the expected on-disk path from each route key. If the actual file/directory name differs, the validator warns.

### `toDiskSegment()` Behavior
- Takes a camelCase route key (e.g., `authLogin`)
- Splits on uppercase letter boundaries
- Lowercases each segment
- Joins with `-`

| Route Key      | toDiskSegment() Output |
|----------------|------------------------|
| `authLogin`    | `auth-login`           |
| `authRegister` | `auth-register`        |
| `authLogout`   | `auth-logout`          |
| `home`         | `home`                 |
| `assets`       | `assets`               |

### Route Type → Disk Mapping

| Route Syntax   | `remix doctor` Expects                           |
|----------------|---------------------------------------------------|
| `get(path)`    | Flat file: `app/actions/{kebab-name}.tsx`     |
| `post(path)`   | Flat file: `app/actions/{kebab-name}.tsx`     |
| `form(path)`   | Directory: `app/actions/{kebab-name}/controller.tsx` |

## Fix Pattern

### 1. Identify route keys and their types
Check `app/routes.ts` for each route's type (`get()`, `post()`, `form()`).

### 2. Convert to kebab-case
Apply `toDiskSegment()` mentally: split each camelCase key on uppercase boundaries and lowercase.

### 3. Create correct file structure

For `form()` routes:
```sh
mkdir -p app/actions/{kebab-name}
touch app/actions/{kebab-name}/controller.tsx
# Export default function from controller.tsx
```

For `get()`/`post()` routes:
```sh
touch app/actions/{kebab-name}.tsx
# Export named function from {kebab-name}.tsx
```

### 4. Update `app/router.ts` imports

Flat actions (`get()`/`post()`) → named import:
```typescript
import { exportName } from './actions/{kebab-name}.tsx'
```

Directory controllers (`form()`) → default import:
```typescript
import controllerName from './actions/{kebab-name}/controller.tsx'
```

## Example: Auth Route Fix

**Before** (old nested structure that triggers warnings):
```
app/actions/auth/
├── login.tsx           # ❌ Wrong: should be auth-login/controller.tsx
├── register.tsx        # ❌ Wrong: should be auth-register/controller.tsx
└── logout.tsx          # ❌ Wrong: should be auth-logout.tsx
```

**After** (matching `remix doctor` convention):
```
app/actions/
├── controller.tsx        # Root: top-level Route leaves (assets, home, etc.)
├── auth-login/
│   └── controller.tsx   # ✅ form('login') → directory with default export
├── auth-register/
│   └── controller.tsx   # ✅ form('register') → directory with default export
└── auth-logout.tsx      # ✅ post('logout') → flat with named export
```

## Export Convention Summary

| Route Type | Export           | Signature                                  |
|------------|------------------|--------------------------------------------|
| `get()`    | Named function   | `export function handler(context, params)` |
| `post()`   | Named function   | `export function handler(context, params)` |
| `form()`   | Default function | `export default function (context, params)` |

## Codebase References

- Route definitions: `my_app/app/routes.ts`
- Router imports: `my_app/app/router.ts` (lines 12-16 show correct import patterns)
- Controller files: `my_app/app/actions/`

## Related

- `../concepts/architecture.md` — Full architecture documentation
- `development/remix3/concepts/routing.md` — Route definition patterns
- `development/remix3/lookup/form-data-reference.md` — `form()` vs `post()` semantics
