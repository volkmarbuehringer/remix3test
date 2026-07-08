## Context

The `parseId()` utility in `app/utils/ids.ts` accepts `unknown`, returns `number | undefined`. It handles numbers, numeric strings, rejects NaN, Infinity, non-numeric strings, and values outside `Number.MAX_SAFE_INTEGER`. Every manual site currently does:

```ts
let id = Number(context.params.id)          // "abc" → NaN
if (!Number.isFinite(id) || id < 1) {       // catches NaN, Infinity, 0, negatives
  return context.json({ ok: false, error: 'Invalid id' }, { status: 400 })
}
```

The replacement:

```ts
let id = parseId(context.params.id)
if (id === undefined || id < 1) {
  return context.json({ ok: false, error: 'Invalid id' }, { status: 400 })
}
```

## Goals / Non-Goals

**Goals:**
- Replace all `Number(context.params.xxx)` + `Number.isFinite` guards with `parseId()` calls
- Keep every error response (status code, message, JSON shape) identical
- Add `parseId` import to every affected controller

**Non-Goals:**
- Not changing the `s.parse(s.number(), Number(context.params.id))` pattern in api/lists and lists controllers (different approach — schema-based, not utility-based)
- Not changing field-level ID validations inside schemas (e.g., `resource_id` in form schemas — those use `coerce.number()`)
- Not modifying `parseId()` itself

## Decisions

**1. Keep `id < 1` guard after `parseId`**
- `parseId` returns `undefined` for invalid input, but doesn't enforce a lower bound of 1. The `< 1` check is a business rule (DB IDs start at 1) that `parseId` shouldn't hardcode (it's used in auth middleware where other constraints apply). Keep the separate check.

**2. One import per file, not a re-export barrel**
- Each affected controller adds `import { parseId } from '../../../utils/ids.ts'` individually. No shared barrel file — keeps dependencies explicit.

## Risks / Trade-offs

- **[Low] Missing a site**: The grep found 24 sites. Automated replace is risky because the variable name and guard pattern vary slightly. Each site needs individual attention to get the variable name right.
- **[Low] parseId doesn't trim whitespace**: `Number('  42  ')` → 42, but `parseId('  42  ')` returns `undefined`. Route params rarely have whitespace, so this is theoretical.
