# Proposal

## Why

Phase 2 enabled a curated suspicious-rule set. Two more explicit rules are
low-volume and behavior-safe: `eslint/no-shadow` catches accidental variable
reuse, and `typescript/no-unnecessary-type-arguments` removes redundant default
type arguments. The third candidate, `typescript/consistent-return`, is
deferred: its findings are exhaustive union switches that TypeScript already
proves total, so fixing them would require inventing default behavior.

## What Changes

- Enable `eslint/no-shadow` and `typescript/no-unnecessary-type-arguments` as
  explicit rules in `.oxlintrc.json`, keeping every built-in category `"off"`.
- Rename the inner shadowing bindings and drop the redundant default type
  arguments; no runtime behavior changes.
- Amend the `lint-config` spec.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `lint-config`: add the two curated rules to the explicit rule set.

## Impact

- `.oxlintrc.json`
- ~12 source files under `app/` and `scripts/`
