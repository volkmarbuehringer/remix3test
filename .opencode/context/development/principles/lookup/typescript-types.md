# TypeScript Type Lookup

Quick reference for TypeScript type design.

## Don't → Do

| Don't | Do |
|-------|-----|
| `any` | `unknown` → narrow with guards |
| `as Type` | Validated runtime check + helper |
| `@ts-ignore` | Fix type model |
| `value!` | Explicit null check |

## Types

- `unknown`: External input (validate before use)
- `never`: Function that never returns
- `void`: Callback ignores return
- `any`: Last resort only

## Patterns

```typescript
// Discriminated union
type Result = { ok: true; data: T } | { ok: false; error: E };

// Type guard
function isString(v: unknown): v is string {
  return typeof v === 'string';
}

// Assertion function (with proof)
function assertString(v: unknown): asserts v is string {
  if (typeof v !== 'string') throw new Error('Not string');
}
```

## Imports

```typescript
import type { Type } from './file.ts';  // type only
import { type Type, value } from './file.ts';  // mixed
```

## Key References

- Full: `concepts/typescript-types.md`
- Repo: AGENTS.md (TypeScript section)