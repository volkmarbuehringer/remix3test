# Partial Writes vs Table Hooks (`beforeWrite` → `validate`)

**Extracted:** 2026-10-31
**Revalidated:** 2026-11-11 against preview release `v0.20261112.4624-main-d4a24d56` / source `d4a24d56` (`@remix-run/data-table` 1.0.0; `src/lib/database/write-lifecycle.ts:278-318`).
**Context:** A `table()` definition combines a `beforeWrite` normalizer with a `validate` hook, and callers issue partial updates (`db.update`, PATCH/PUT bodies). Extracted while reviewing guide ch. 8 against `app/data/schema.ts` (`appointments`, `appointofferings`).

## Problem

`validate` does not receive the caller's payload. The driver runs `beforeWrite`, re-normalizes its returned `{ value }`, and only then calls `validate` with that normalized payload (`@remix-run/data-table` at preview release `v0.20261112.4624-main-d4a24d56`, `src/lib/database/write-lifecycle.ts:278-318`; vendor README: `Write order is beforeWrite -> validate ...` and `Write payloads are partial objects`). Hooks are synchronous and cannot read the stored row, so a partial payload is all `validate` sees.

Three failure modes:

1. **Dead validation on derived/stripped columns.** An `appointments`-style `beforeWrite` folds `start_min`/`end_min` into `during` and deletes the pair. A `validate` that checks `value.start_min`/`value.end_min` therefore always sees `undefined` and silently passes; only the DB CHECK remains. Validate the derived column instead.
2. **One-sided partial update throws.** A `beforeWrite` that enforces a pair (`if exactly one bound is present → throw`) rejects a legitimate one-sided update (`PUT { start_min }`) with `DataTableConstraintError` before `validate` runs — surfacing as an unhandled 500. Merge the stored counterpart at the data-layer boundary.
3. **Required fields reject every update.** A `validate` that unconditionally requires create-only fields (`resource_id`, `day`, `during`) fails every partial `db.update` with `DataTableValidationError`. Gate each requirement on `operation === 'create'` — hook context is exactly `{ operation: 'create' | 'update' }` (README), even though the write methods include `insert`/`upsert`/`*Many`.

## Solution

### 1. Validate the derived column, not the stripped inputs

In `app/data/schema.ts` (`appointments`), `beforeWrite` folds `start_min`/`end_min` into `during` and deletes the pair; `validate` checks `during` (not the stripped inputs) and keys issues back to `start_min`/`end_min` for the form.

### 2. Merge one-sided pair updates before writing

```ts
// app/data/appointments.ts — updateAppointment
if (input.start_min !== undefined || input.end_min !== undefined) {
  update.start_min = input.start_min ?? existing.start_min
  update.end_min = input.end_min ?? existing.end_min
}
```

`existing` is the row already read for the ownership/24h guard; both computed columns are on it. At the request boundary, check the **merged** pair (`parsed.value.start_min ?? current.start_min`, same for `end_min`) against `MINIMUM_DURATION` and return a 400 — see `app/actions/appointment/controller.tsx`. This catches a merged 5-minute slot before it reaches the hook.

### 3. Gate required checks on create

In `app/data/schema.ts` (`appointofferings`), gate `resource_id`/`day`/`during` on `operation === 'create'`; a partial `db.update` then passes.

If a rule must hold for every write regardless of partiality, put it in SQL (CHECK/exclusion) — a synchronous hook cannot see the stored row.

## When to Use

- A `validate` hook reads a column that `beforeWrite` derives, renames, or deletes — the check silently never fires.
- A one-sided update of a paired invariant (`start`/`end`, `min`/`max`, `from`/`to`) throws `DataTableConstraintError` from `beforeWrite` or returns a 500.
- Adding required-field checks to a table whose rows are also partially updated (`db.update`, `updateMany`, PATCH handlers).
- Reviewing a data-table write path for validation completeness.

**App anchors:** `app/data/schema.ts` (`appointments` validate/beforeWrite, `appointofferings` validate), `app/data/appointments.ts` (`updateAppointment`), `app/actions/appointment/controller.tsx` (merged-duration guard); tests `app/actions/appointment/controller.test.ts` ("PUT /appointment/:id (partial slot update)") and `app/data/appointofferings.test.ts` ("accepts a partial typed update that changes only day").
