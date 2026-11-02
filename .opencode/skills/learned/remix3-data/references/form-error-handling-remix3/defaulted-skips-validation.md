# `s.defaulted` Returns Its Default Without Running The Wrapped Schema

**Discovered:** 2026-10-17 — agent-events prompt schema (`85a552c` fix for review on `154acc3`)

## Vendor fact (version-pinned)

`@remix-run/data-schema` build `7f900151117c4_ac90b94f348a9875243225812076b8a0` (the current install):

- `src/lib/schema.ts:515` — `export function defaulted<input, output>(...)`
- `src/lib/schema.ts:519-525` — when the input is `undefined`, `defaulted` resolves the
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
passes `undefined` to the inner schema (`form-data.ts:226`, `value ?? undefined`),
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
  `pageSize`/`pageKey` schemas in `app/utils/get-page-size.ts`, where absence must mean
  "no override", or where the default already satisfies the schema's own checks).
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
// Ran directly on the 2026-10-17 install — see skill delta for line refs.
```
