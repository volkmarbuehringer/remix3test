# Proposal

## Why

Phase 1 (archived change `tighten-lint-rules`) enabled the type-aware
`typescript/no-floating-promises` rule. The `lint-config` contract allows more
high-signal rules to be enabled explicitly, one at a time, while keeping the
built-in categories `"off"`. A curated set of array-mutation and error-handling
rules catches real bugs without the ~1576-finding noise of the `suspicious`
category.

## What Changes

- Enable the explicitly-listed rules `unicorn/no-array-sort`,
  `unicorn/no-array-reverse`, `eslint/preserve-caught-error`, and
  `eslint/no-unsafe-optional-chaining` in `.oxlintrc.json`.
- Fix every finding: non-mutating `toSorted()`/`toReversed()`, attach the caught
  error as `cause`, and guard the unsafe optional chain.
- Amend the `lint-config` spec to require the curated rule set.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `lint-config`: add a requirement that these curated high-signal rules stay
  explicitly enabled while categories remain off.

## Impact

- `.oxlintrc.json` — four explicit rules in the shared override
- ~20 source files under `app/` and `scripts/`
