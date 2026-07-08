## Why

24+ action controller sites manually convert `context.params.id` with `Number()` then guard with `!Number.isFinite(id) || id < 1`. This is a repeated two-step pattern that produces silent NaN when the param is non-numeric, and is only caught by the subsequent guard. The utility `parseId()` already exists in `app/utils/ids.ts` with full test coverage but is only used in one place — the auth middleware. This change consolidates the 24+ manual sites onto the shared utility, removing duplication and ensuring consistent behavior.

## What Changes

- Replace every `Number(context.params.xxx) + if (!Number.isFinite(xxx) || xxx < 1)` with the equivalent `parseId()` pattern across all action controllers
- No behavioral changes — error response codes and messages stay the same
- No breaking changes

## Capabilities

### New Capabilities

None — implementation consolidation within existing code.

### Modified Capabilities

None — no spec-level behavior changes.

## Impact

- `app/utils/ids.ts` — unchanged (already exists, already tested)
- 10+ controller files receive import additions and pattern replacements
- The `parseId()` utility goes from 1 caller to ~25 callers
- Future route handlers benefit from an established pattern to follow
