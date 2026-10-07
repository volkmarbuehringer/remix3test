# Lenient zod Schemas at Vendor Boundaries

**Source:** `zod-vendor-boundary-leniency`
**Extracted:** 2026-10-07
**Context:** zod v4 validating a vendor stream/JSON payload where absent fields may be `null` and a failed parse is handled by skipping the item (Mastra stream chunks in `app/utils/agent-sse.ts`).

## Problem

Two independent traps turn a validation boundary into silent data loss:

1. **`.optional()` rejects `null`.** Vendors commonly serialize "absent" as `null` (Mastra sends `suspendPayload.options: null`), not `undefined`. `z.object({ options: z.array(...).optional() })` fails the whole object; if the nested value is itself wrapped in `.catch(undefined)`, the entire field silently becomes `undefined` and the consumer never sees the question/suspension.
2. **One bad field fails the whole `safeParse`.** When the caller handles `!success` by `continue`/skip, a single unexpected nested type drops the whole event — including terminal events (`finish`, suspension) whose loss ends a turn with no error.

## Solution

- Model "absent" as `.nullish()`, not `.optional()`, for any field the vendor may send as `null` — including nested objects and their fields.
- Add `.catch(undefined)` to each leaf/nested schema so an unexpected type degrades to `undefined` instead of failing; let only the envelope discriminator (`type: z.string()`) be able to fail the parse.
- Reads of a `.catch(undefined)` field are `T | undefined`, so the `as` casts disappear too (this removed ~13 of them).

```ts
const suspensionPayloadSchema = z.object({
  question: z.string().nullish().catch(undefined),
  options: z.array(chatOptionSchema).nullish().catch(undefined),
  selectionMode: z.string().nullish().catch(undefined),
})

const agentChunkSchema = z.object({
  type: z.string(),
  payload: agentChunkPayloadSchema.nullish().catch(undefined),
  textDelta: z.string().optional().catch(undefined),
})
```

- Test with the vendor's real "absent" encoding (`null`), not just a missing key. A fixture with `options: null` is what exposed the bug after a hand-written guard had passed.
- If a parse failure means "skip this item", assert that skipping cannot drop a terminal event; prefer lenient decoding over strict rejection at a firehose boundary.

## When to Use

- zod-parsing a third-party stream/HTTP/webhook payload whose shape varies by event type.
- A `safeParse`/`parse` failure is handled by skipping, filtering, or defaulting rather than surfacing an error.
- Vendor fixtures use `null` for absent fields, or a previously passing test starts losing events after a schema is added.
