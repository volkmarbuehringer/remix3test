## Context

The `listTestFiles` tool in `app/actions/mastra/tools/test-tools.ts` is a custom file-listing tool used by the test agent (`app/actions/mastra/agents/test-agent.ts`). It has no `outputSchema` — the return type is inferred from the `execute` function's return statement. The LLM receives the output as raw JSON with no field-level descriptions. Errors use an ad-hoc `{ error: string }` shape mixed into the success type.

Across the project's 20+ Mastra tools, the same pattern holds: zero tools define `outputSchema`, and error idioms vary wildly — `{ error: string }`, `{ found: false, message }`, `{ success: false, error }`, empty results, exception propagation.

The Mastra `ToolAction` interface supports `outputSchema?: PublicSchema<TSchemaOut>` and a `toModelOutput` hook, but neither is used anywhere in the project.

## Goals / Non-Goals

**Goals:**
- Add `outputSchema` to `listTestFiles` with a `z.discriminatedUnion('success', [...])` defining success and error shapes
- Every output field gets a `.describe()` so the LLM knows units (bytes, ms), semantics (what to use for sorting vs display), and purpose
- Typed error codes (`VALIDATION`, `NOT_FOUND`, `DEPENDENCY`, `INTERNAL`) that the LLM can pattern-match for recovery
- Update tests to access through envelope fields instead of raw casts
- Extract shared error primitives to a module that other tools can import

**Non-Goals:**
- Changing the agent instructions — the LLM sees the same data, just with descriptions
- Applying `outputSchema` to other tools — that's a follow-up after this pattern is proven
- Changing `toModelOutput` — the envelope goes all the way to the LLM as-is
- Altering the `execute` function's business logic (file traversal, sorting, filtering)

## Decisions

### Decision 1: Envelope goes to the LLM untransformed

No `toModelOutput` hook. The discriminated union (`success: true | false`) is what the LLM receives. Reasoning:
- Explicit is better than implicit — the LLM can check `success` before acting
- One fewer abstraction to maintain
- If we later want to strip the envelope, `toModelOutput` is zero-cost to add

### Decision 2: Error codes over freeform strings

A `z.enum(['VALIDATION', 'NOT_FOUND', 'DEPENDENCY', 'INTERNAL'])` instead of a bare `z.string()`. Reasoning:
- The LLM can branch on `error.code` (e.g. "if DEPENDENCY, suggest retry; if VALIDATION, tell user what's wrong")
- Enables typed error handling in agent instructions
- Freeform strings drift; enums stay consistent

### Decision 3: Shared error module

Extract error primitives into `app/actions/mastra/tools/errors.ts`:
- `ErrorCode` Zod enum
- `errorEnvelope` Zod object (the `{ success: false, error: { code, message } }` shape)
- Optionally `successData<T>` helper for wrapping typed data into the success envelope

This is a small extraction (3-5 lines of schema + a generic helper) that pays for itself as soon as a second tool adopts the pattern.

### Decision 4: `as const` on execute returns

`z.literal(true)` and `z.literal(false)` in the discriminated union require literal types. The `execute` function returns `as const` on success/false/error code to satisfy TypeScript narrowing. This is minimal ceremony — ~5 `as const` annotations.

### Alternatives considered

- **Using `toModelOutput` to strip the envelope**: Rejected — the LLM benefits from seeing `success: true/false` explicitly, and it adds a transformation layer for no clear gain
- **No shared error module (inline in test-tools.ts)**: Acceptable for a single tool, but the whole point of this change is to establish a pattern. Extracting to a shared module signals intent
- **Wrapping `createTool` with a helper that auto-injects the envelope**: Over-engineering for the proving ground phase. If the pattern proves out across 3+ tools, revisit

## Risks / Trade-offs

- **[Churn] All existing `listTestFiles` callers access through envelope**: Mitigation — only caller is `test-tools.test.ts`, which is adjusted in this change. No runtime callers outside tests.
- **[TypeScript complexity] `z.discriminatedUnion` with literal types requires `as const`**: Acceptable — the annotations are explicit and local to the return statements. If forgotten, TypeScript catches it.
- **[Scope creep] Shared error module invites immediate use by other tools**: Mitigation — explicitly non-goaled. The module exists as a target, not a mandate.
