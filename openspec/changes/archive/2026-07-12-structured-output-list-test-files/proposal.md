## Why

The `listTestFiles` tool returns its output as an untyped JSON blob with no schema description for the LLM. The model has to infer field semantics (is `mtime` seconds or ms? is `size` bytes or KB?). Error cases are smuggled through the success return shape as `{ error: string }`. Across the project's 20+ tools, 6 different error idioms are used — the LLM must learn each one individually. Adding a `z.outputSchema` with field descriptions and a discriminated error union gives the LLM explicit semantics for every field and a consistent error contract.

## What Changes

- Add `outputSchema` to `listTestFiles` using `z.discriminatedUnion('success', [...])` — one shape for success (full output with path, files, display fields), one for errors (code + message)
- Every output field gets a `.describe()` so the LLM knows units and semantics
- Errors use a typed `ErrorCode` enum (`VALIDATION`, `NOT_FOUND`, `DEPENDENCY`, `INTERNAL`) shared as a pattern for future tools
- Tests update from ad-hoc `as` casts to typed access through the envelope
- The `display` sub-object is retained in full — the `outputSchema` describes it, the LLM sees it

## Capabilities

### New Capabilities

- `structured-tool-output`: Typed output schemas with discriminated error unions for Mastra tools, starting with `listTestFiles` as the proving ground

### Modified Capabilities

None. No existing spec-level requirements change — this is an implementation refinement.

## Impact

- `app/actions/mastra/tools/test-tools.ts` — add `outputSchema`, refactor `execute` returns to tagged union, remove ad-hoc error returns
- `app/actions/mastra/tools/test-tools.test.ts` — update assertions to access through envelope fields instead of raw casts
- Optionally: extract shared error types (`ErrorCode`, error envelope Zod schema) to a shared module like `app/actions/mastra/tools/errors.ts` for reuse
