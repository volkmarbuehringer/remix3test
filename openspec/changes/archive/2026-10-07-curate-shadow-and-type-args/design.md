# Design

## Context

After Phases 1–2 the explicit rule set covers floating promises and
mutation/error-handling. The next low-volume candidates from the
`suspicious` category are shadowing (20 findings) and redundant default type
arguments (5 findings).

## Decisions

### Rule set

- `eslint/no-shadow` — rename only the inner binding that shadows an outer one
  (a module import, a component handle, or an outer local). The outer binding
  and all other names are untouched.
- `typescript/no-unnecessary-type-arguments` — remove a type argument whose
  value equals the parameter's default. The resulting type is unchanged.

### consistent-return is deferred

Its findings are functions with an exhaustive `switch` over a string-literal
union. TypeScript's control-flow analysis treats the implicit end as
unreachable, so `noImplicitReturns` accepts them, but oxlint does not model the
exhaustiveness. Fixing the annotated ones (e.g. `: string`) would require
inventing a default return value, which is a behavior decision, not a lint fix.

## Risks / Trade-offs

- **Risk**: a rename changes a closure reference. **Mitigation**: only the
  shadowing binding and its uses in the same scope are renamed; typecheck and
  the full suite back it.

## Migration Plan

1. Add the two rules.
2. Fix all findings.
3. `typecheck` + `lint` + full tests, commit, archive.
