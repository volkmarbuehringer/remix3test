## Why

The entire remix monorepo upstream recently adopted `"erasableSyntaxOnly": true` across all 91+ `tsconfig.json` files. This newapp should follow suit to stay aligned with upstream conventions and benefit from the compile-time guardrails this option provides.

`erasableSyntaxOnly` prevents TypeScript syntax that requires runtime transformation (enums, namespaces, parameter properties, decorators). Since newapp uses none of these, adding it is a zero-risk alignment that catches accidental use going forward.

## What Changes

- Add `"erasableSyntaxOnly": true` to `compilerOptions` in `tsconfig.json`

No code changes. No dependency changes. No behavioral changes. Pure configuration alignment.

## Capabilities

### New Capabilities

- `tsconfig-alignment`: Ensure the TypeScript configuration follows upstream remix conventions, including `erasableSyntaxOnly`, to maintain consistency and prevent use of syntax that requires runtime transformation.

### Modified Capabilities

_(None — no existing specs are changing)_

## Impact

- **Affected**: `tsconfig.json` (1 line addition)
- **No API changes**: No public APIs, no exports, no runtime behavior
- **No dependency changes**: No packages added or removed
- **Safety**: TypeScript compilation already passes; this is a lint-style restriction only
