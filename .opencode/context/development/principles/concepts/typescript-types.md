# TypeScript Type Design

**Purpose**: Write precise TypeScript that makes invalid states hard to represent.

## Core Concept

Use TypeScript to enforce contracts at compile time. Prefer `unknown` over `any` for untrusted input; validate and narrow before use. Avoid type holes (assertions, `!`, `@ts-ignore`) that bypass checking.

## Key Principles

- **Type model first**: Let inference work for locals; add explicit types on exports / public APIs
- **Avoid `any`**: Use `unknown` at boundaries; narrow before use; treat `any` as last resort
- **Discriminated unions**: Use for states that affect behavior (mode, status, kind, variant)
- **Validate boundaries**: Parse/narrow untrusted input (JSON, request bodies, params) before internal types
- **Type-only imports**: Use `import type { X }` and `.ts` extensions in imports

## Type Design Rules

| Pattern | Use | Avoid |
|---------|-----|-------|
| Object shapes | `interface` | — |
| Unions/tuples | `type` | — |
| Literal tables | `as const` | Plain objects |
| Reusable checks | Type guards | Repeated casts |

## Function Rules

- Overloads only when call signatures genuinely differ
- Prefer union params over overloads with same implementation
- Use `() => void` for callbacks (return ignored)
- Avoid boolean flags; use option objects or discriminated unions

## Null Safety

- Handle `null`/`undefined` before use
- Explicit checks: `value !== null` over truthiness when `"" | 0 | false` valid
- `property?: T` = absent property; `property: T | undefined` = key present, value missing
- Non-null assertion (`!`) only when nearby invariant proves existence

## Type Holes Prevention

```
DON'T                    DO
─────────────────────────────────────────────
any                     unknown → narrow with type guards
as SomeType             Add runtime validation, use type guard
@ts-ignore              Improve type model or API shape
value!                  Explicit null check before use
```

## Minimal Example

```typescript
// Boundary: parse and narrow untrusted input
function parseId(input: unknown): number {
  if (typeof input !== 'number' || !Number.isFinite(input)) {
    throw new Error('Invalid id');
  }
  return input;
}

// Discriminated union for states
type Status = { kind: 'loading' } | { kind: 'ok'; data: string } | { kind: 'error'; message: string };

function handle(status: Status) {
  switch (status.kind) {
    case 'ok': return status.data;      // narrowed
    case 'error': return status.message;
    case 'loading': return null;
  }
}
```

## Official Sources

- [TypeScript Handbook: Everyday Types](https://www.typescriptlang.org/docs/handbook/2/everyday-types.html)
- [TypeScript Handbook: Narrowing](https://www.typescriptlang.org/docs/handbook/2/narrowing.html)
- [Declaration Files: Do's and Don'ts](https://www.typescriptlang.org/docs/handbook/declaration-files/do-s-and-don-ts.html)

---

**Full skill**: `/home/lucky/remix/.agents/skills/expert-typescript-programmer/SKILL.md`