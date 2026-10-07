# Proposal

## Why

Phases 1–3 enabled an explicit, low-volume rule set. The last behavior-relevant
`suspicious`-category rule is `typescript/consistent-return`: it flags
functions whose code paths do not all return (or all return a value). Each
finding can be made consistent without changing behavior for any type-valid
input.

## What Changes

- Enable `typescript/consistent-return` explicitly in `.oxlintrc.json`.
- Make every flagged function's returns consistent: the final exhaustive
  `switch` case becomes `default`, bare `return` becomes `return undefined`,
  and the `process.exit(1)` path becomes `return process.exit(1)` (`never`).
- Amend the `lint-config` spec.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `lint-config`: add `typescript/consistent-return` to the explicit rule set.

## Impact

- `.oxlintrc.json`
- 9 source files under `app/` and `server.bun.ts`
