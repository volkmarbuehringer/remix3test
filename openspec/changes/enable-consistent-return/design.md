# Design

## Context

The 16 `consistent-return` findings split into two kinds. Fourteen are real
in-scope functions (two are vendored `.mjs` scripts, excluded by scoping the
rule to the `**/*.{ts,tsx,js,jsx}` override).

## Decisions

### Fix strategy keeps behavior identical for every type-valid input

- **Exhaustive `switch` on a string-literal union** — change the final `case`
  to `default`. For every value in the union the branch is unchanged; only an
  out-of-contract runtime value now hits that branch instead of falling through.
- **Bare `return` mixed with value returns** — write `return undefined`
  explicitly (`frame-response.browser.tsx`) or `return null` (`nav-toggle`).
- **`loadTls`** — the catch calls `process.exit(1)`, typed `never`, so the
  function can never fall through; `return process.exit(1)` expresses that
  without adding unreachable code (the repo sets `allowUnreachableCode: false`).
- **`markdown-text.tsx` render maps** — add `default: return null`; `null` and
  the prior implicit `undefined` both render nothing.

### Scoped to the shared override

Putting the rule in `**/*.{ts,tsx,js,jsx}` excludes the vendored
`provider-registry.mjs` copies, so no `ignorePatterns` change is needed.

## Risks / Trade-offs

- **Risk**: converting a real `case` to `default` could mask a newly added union
  member. **Mitigation**: TypeScript still checks the `default` body against the
  declared return type, and the branch is the previously-selected case's body.

## Migration Plan

1. Add the rule.
2. Apply the fixes.
3. `typecheck` + `lint` + full tests, commit, archive.
