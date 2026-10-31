# Partial Writes vs Table Hooks (`beforeWrite` → `validate`)

**Extracted:** 2026-10-31
**Context:** A `table()` definition combines a `beforeWrite` normalizer with a `validate` hook, and callers issue partial updates (`db.update`, PATCH/PUT bodies). Extracted while reviewing guide ch. 8 against `app/data/schema.ts` (`appointments`, `appointofferings`).

## Problem

`validate` does not receive the caller's payload. The driver runs `beforeWrite`, re-normalizes its returned `{ value }`, and only then calls `validate` with that normalized payload (`@remix-run/data-table` build `57ecca4cba`, `src/lib/database/write-lifecycle.ts:271-318`; vendor README: `Write order is beforeWrite -> validate ...` and `Write payloads are partial objects`). Hooks are synchronous and cannot read the stored row, so a partial payload is all `validate` sees.

Three failure modes:

1. **Dead validation on derived/stripped columns.** An `appointments`-style `beforeWrite` folds `start_min`/`end_min` into `during` and deletes the pair. A `validate` that checks `value.start_min`/`value.end_min` therefore always sees `undefined` and silently passes; only the DB CHECK remains. Validate the derived column instead.
2. **One-sided partial update throws.** A `beforeWrite` that enforces a pair (`if exactly one bound is present → throw`) rejects a legitimate one-sided update (`PUT { start_min }`) with `DataTableConstraintError` before `validate` runs — surfacing as an unhandled 500. Merge the stored counterpart at the data-layer boundary.
3. **Required fields reject every update.** A `validate` that unconditionally requires create-only fields (`resource_id`, `day`, `during`) fails every partial `db.update` with `DataTableValidationError`. Gate each requirement on `operation === 'create'` — hook context is exactly `{ operation: 'create' | 'update' }` (README), even though the write methods include `insert`/`upsert`/`*Many`.

## Solution

### 1. Validate the derived column, not the stripped inputs

```ts
// app/data/schema.ts — appointments
beforeWrite({ operation, value }) {
  let next = { ...value }
  validateAppointmentTimes(next.start_min, next.end_min) // pair rule lives here
  if (next.start_min !== undefined && next.end_min !== undefined) {
    next.during = `[${next.start_min},${next.end_min})`
  }
  delete next.start_min
  delete next.end_min
  return { value: next }
},
validate({ operation, value }) {
  let issues = []
  if (value.during !== undefined) {
    let range = parseDuring(value.during)
    if (
      range === null ||
      range.startMin < 0 ||
      range.endMin > 1440 ||
      range.startMin >= range.endMin
    ) {
      issues.push({
        message: 'during must be a positive range within a day (0–1440).',
        path: ['start_min'],
      })
    }
  }
  return issues.length > 0 ? { issues } : { value }
},
```

### 2. Merge one-sided pair updates before writing

```ts
// app/data/appointments.ts — updateAppointment
if (input.start_min !== undefined || input.end_min !== undefined) {
  update.start_min = input.start_min ?? existing.start_min
  update.end_min = input.end_min ?? existing.end_min
}
```

`existing` is the row already read for the ownership/24h guard; both computed columns are on it. At the request boundary, run duration/bookability checks on the **merged** pair — not only when both fields were supplied — so a merged 5-minute slot returns 400 instead of reaching the hook:

```ts
// app/actions/appointment/controller.tsx
let mergedStartMin = parsed.value.start_min ?? current.start_min
let mergedEndMin = parsed.value.end_min ?? current.end_min
if (mergedEndMin - mergedStartMin < MINIMUM_DURATION) {
  return context.json(
    { error: `Minimum duration is ${MINIMUM_DURATION} minutes.` },
    { status: 400 },
  )
}
```

### 3. Gate required checks on create

```ts
// app/data/schema.ts — appointofferings
validate({ operation, value }) {
  let issues = []
  if (operation === 'create' && value.resource_id === undefined) { /* push */ }
  if (operation === 'create' && value.day === undefined) { /* push */ }
  if (operation === 'create' && value.during === undefined) { /* push */ }
  return issues.length > 0 ? { issues } : { value }
},
```

If a rule must hold for every write regardless of partiality, put it in SQL (CHECK/exclusion) — a synchronous hook cannot see the stored row.

## When to Use

- A `validate` hook reads a column that `beforeWrite` derives, renames, or deletes — the check silently never fires.
- A one-sided update of a paired invariant (`start`/`end`, `min`/`max`, `from`/`to`) throws `DataTableConstraintError` from `beforeWrite` or returns a 500.
- Adding required-field checks to a table whose rows are also partially updated (`db.update`, `updateMany`, PATCH handlers).
- Reviewing a data-table write path for validation completeness.

**App anchors:** `app/data/schema.ts` (`appointments` validate/beforeWrite, `appointofferings` validate), `app/data/appointments.ts` (`updateAppointment`), `app/actions/appointment/controller.tsx` (merged-duration guard); tests `app/actions/appointment/controller.test.ts` ("PUT /appointment/:id (partial slot update)") and `app/data/appointofferings.test.ts` ("accepts a partial typed update that changes only day").
