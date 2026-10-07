# Proposal

## Why

The TypeScript-hardening session deferred tightening oxlint because enabling the
`correctness`/`suspicious` categories wholesale surfaced 344/1576 findings. The
highest-signal item from that review is the type-aware rule
`typescript/no-floating-promises`: the codebase has 167 floating-promise sites,
and the `lint-config` spec explicitly permits enabling individual rules while
keeping the built-in categories `"off"`.

## What Changes

- Enable the explicitly-listed, type-aware rule `typescript/no-floating-promises`
  in `.oxlintrc.json` (not its category).
- Deliberately handle every existing floating-promise site, preserving runtime
  behavior. The rule's suggestion — `void expr` — is runtime-identical to
  `expr`, so it records intent rather than changing behavior.
- Record in the `lint-config` spec that type-aware promise handling is enforced
  through explicitly-listed rules.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `lint-config`: add a requirement that every thenable expression statement is
  deliberately handled, enforced by the explicitly-listed
  `typescript/no-floating-promises` rule.

## Impact

- `.oxlintrc.json` — one new explicit rule in the TypeScript override
- ~24 source files under `app/` — `void` annotations on floating promises
- No runtime behavior change (annotations are no-ops)
