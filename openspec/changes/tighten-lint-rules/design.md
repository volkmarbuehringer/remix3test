# Design

## Context

This repo's lint config sets every built-in oxlint category to `"off"` and
enables only explicitly-listed rules (see `openspec/specs/lint-config/spec.md`).
The handoff review measured the cost of enabling `correctness`/`suspicious`
wholesale at ~344 and ~1576 findings. In contrast, the single type-aware rule
`typescript/no-floating-promises` has 167 findings, is concentrated in two
client files (lists-client.tsx: 57, appointment-grid.browser.tsx: 34), and has
an autofix.

## Goals / Non-Goals

- **Goal**: make unhandled thenables a build failure, with zero runtime change.
- **Non-Goal**: enabling the `correctness` or `suspicious` categories; auditing
  every `void` site for a semantically better `.catch()`/`await`.

## Decisions

### Enable the rule, not the category

The spec's scenario forbids implicit category rules but allows explicit ones.
`typescript/no-floating-promises` is added to the existing TypeScript override
alongside `consistent-type-imports`, `consistent-type-exports`, etc.

### Use the rule's `void` suggestion for the bulk pass

`void promise` evaluates the expression and discards the result — identical
runtime semantics to the current floating statement. It makes the
fire-and-forget intent explicit and satisfies the rule. Sites that genuinely
need rejection handling remain a separate, behavior-changing follow-up.

### Type-aware settings are already in place

`options.typeAware` is `true`, so the rule runs without extra CLI flags.

## Risks / Trade-offs

- **Risk**: a `void` can mask a promise whose rejection should surface.
  **Mitigation**: tests remain the behavior oracle; the annotation changes no
  runtime path. A future task can promote specific sites to `.catch()`.
- **Risk**: the autofix could touch unrelated rules. **Mitigation**: the repo is
  clean for all currently enabled rules, and the diff is reviewed per file.

## Migration Plan

1. Add the rule to `.oxlintrc.json`.
2. Run `oxlint --fix-suggestions` to annotate the 167 sites.
3. `typecheck` + `lint` + full tests.
4. Commit the config and the annotations together.
