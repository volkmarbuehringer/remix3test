# `s.defaulted` Returns Its Default Without Running The Wrapped Schema

**Discovered:** 2026-10-17 — agent-events prompt schema (`85a552c` fix for review on `154acc3`)
**Revalidated:** 2026-11-11 against preview release `v0.20261111.171719-main-0cab1903` / source `0cab1903` (`@remix-run/data-schema` 1.0.0; `defaulted` at `src/lib/schema.ts:667`).

## Vendor fact (version-pinned)

`@remix-run/data-schema` at preview release `v0.20261111.171719-main-0cab1903` / source `0cab1903` (the current install):

- `src/lib/schema.ts:667` — `export function defaulted<input, output>(...)`
- `src/lib/schema.ts:671-685` — when the input is `undefined`, `defaulted` resolves the
  default and returns `{ value: resolved }` **immediately, without invoking the wrapped
  schema's `~run`**. Validations (`.refine`, `.check`, `.transform` chains, etc.) built
  into the wrapped schema never execute for the default path.

The vocab README recommends the pattern without this caveat:

- `node_modules/remix/src/data-schema/README.md:97` — "When you want a fallback value,
  prefer `s.defaulted(s.string(), '')`"

## How it bites: defaulted → required

A form field that is both defaulted and required silently accepts the default:

```ts
// WRONG: a missing `message` field parses as '' and SUCCEEDS.
message: f.field(
  s.defaulted(
    s.string().refine((v) => v.length > 0, 'Message is required'),
    '', // <- returned as-is; the required refine never runs
  ),
)
```

The chain runs only when a string value is present. With `f.field`, a missing entry
passes `undefined` to the inner schema (`src/lib/form-data.ts:231`, `value ?? undefined`),
which `defaulted` swallows into the default.

**App case:** `app/actions/agent-events/controller.tsx` — `promptSchema`. The agent prompt
must fail fast with a 400 on a missing message. With `s.defaulted`, the missing field
parsed to `''`, and validation "succeeded"; the empty message only got caught later
inside the SSE stream (`handlers/validate.ts`), turning a fail-fast 400 into a
fail-slow in-stream rejection. Customer-visible strings were unchanged in this case,
only latency/behavior — but with non-trivially-validated fields the default can
**bypass validation entirely** and be written to the database.

## Rule

- Do not wrap a required / validated field schema in `s.defaulted`. Let the missing field
  fail the base type check; map the generic failure message at the response boundary if
  needed. For `promptSchema`, dropping `s.defaulted` means a missing field fails
  `s.string()` with "Expected string", and `promptIssueMessage()` folds that into the
  canonical "Message is required" 400 — restoring the pre-schema fail-fast behavior.
- `s.defaulted` is fine when the default is itself always valid (e.g. the
  `pageSize`/`pageKey` fields in `app/utils/get-page-size.ts`, where the defaulted
  strings mean "not provided" and the real range check lives on the object-level
  `.refine()` **after** the source-selection `.transform()`; see
  `validation-and-schema.md § Multi-Source Fields`).
- Cross-check every existing `s.defaulted` whose wrapped schema carries `.refine`s: the
  default path has never been validated by them.

## Test anchor

`app/actions/agent-events/prompt-schema.test.ts` — "rejects a missing message field (no
silent empty catch-all)" and the `promptIssueMessage` fold cases. A minimal
reproduction of the vendor behavior:

```ts
let chain = s.string().refine((v) => v.length > 0, 'required')
s.parseSafe(chain, '')                 // fails: required
s.parseSafe(s.defaulted(chain, ''), undefined) // succeeds: ''
// Ran directly against the current install — see the line refs above.
```
