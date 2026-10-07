# Design

## Context

The `suspicious` category mixes a few genuinely bug-shaped rules with high-volume
style/type-assertion rules (no-unsafe-type-assertion: 815,
no-unnecessary-type-assertion: 400). This change enables only the low-volume,
behavior-relevant ones as explicit rules.

## Decisions

### Rule set

- `unicorn/no-array-sort`, `unicorn/no-array-reverse` — catch in-place mutation of
  arrays that callers may not expect; fixed with `toSorted()`/`toReversed()`.
- `eslint/preserve-caught-error` — a re-thrown error should keep its `cause`.
- `eslint/no-unsafe-optional-chaining` — a cast of `a?.b` followed by a property
  access can throw; guard the chain.

### Fix strategy is behavior-preserving

Every `sort`/`reverse` finding is on a fresh array (`[...x]`, `Array.from(x)`,
`x.filter(...)`, `x.map(...)`, or an array literal) or on a local filter result
that is not read again, so `toSorted()`/`toReversed()` returns the same value
without observing a mutation. The `cause` addition only enriches the thrown
error; the optional-chain fix only avoids a throw on `undefined`.

### Scope the rules to the shared TS/JS override

The rules go in the `**/*.{ts,tsx,js,jsx}` override, so vendored `.mjs` scripts
under `.agents/` and `.claude/` are not affected and no `ignorePatterns` change is
needed.

## Risks / Trade-offs

- **Risk**: a `toSorted()` on a fresh array is a no-op behaviorally, but a future
  reader could mistake it for mutating. **Mitigation**: the rule documents the
  non-mutating intent.
- **Risk**: `toSorted`/`toReversed` require ES2023. **Mitigation**: the project
  targets Node 26 / modern browsers.

## Migration Plan

1. Add the four rules to `.oxlintrc.json`.
2. Fix all findings.
3. `typecheck` + `lint` + full tests.
4. Commit and archive the change.
