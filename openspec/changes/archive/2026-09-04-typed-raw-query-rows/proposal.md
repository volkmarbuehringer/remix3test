## Why

Raw SQL through `db.exec` returns untyped rows (`rows?: Record<string, unknown>[]`), so every join query in `app/data/` and the Mastra tools force-casts with `as unknown as` onto hand-written row interfaces. Those interfaces silently drift from the actual pg wire shape — `AppointmentRow.id` is typed `string` while the column is `int4` (pg returns `number`), and `WebhookRequestRow.created_at` is typed `number` while the column is `int8` (pg returns `string`). The casts hide these lies from the compiler, and consumers build compensating workarounds (e.g. `parseInt(row.id)` in `app/actions/verwaltung/appointments/controller.tsx`). This change makes the raw-SQL boundary honest and validated.

## What Changes

- Add `app/data/rows.ts` with `queryRows(db, sql, schema)` and `queryRow(db, sql, schema)` helpers that wrap `db.exec` and zod-parse every returned row, throwing a thin, query-naming error wrapper on mismatch.
- Replace the hand-written raw row interfaces (e.g. `AppointmentRow`, `AppointmentsNewRow`, `OfferingRow`, `WebhookRequestRow`, `Report1Row`, `ResourceOption`) with co-located zod row schemas; row types derived via `z.infer`.
- Decode wire-honest per the pg type mapping: `int4` columns → `z.number()`, `int8` columns → `z.string()`. Aggregate results (`count(*)`, `MIN`/`MAX`/`SUM`/`AVG` over int8) use `z.coerce.number()` as a deliberate boundary normalization.
- Correct the known drift as schemas land: `id`/`*_id` fields become `number`, `WebhookRequestRow.created_at`/`callback_received_at` become `string`; drop the `parseInt(row.id)` workaround.
- Migrate the `app/data/` raw-SQL call sites (~40 casts across the data layer) from `as unknown as` to the helpers. Single-row `RETURNING id` casts become `queryRow` with `z.object({ id: z.number() })`.
- Mastra tool row mapping (`rows.map((r: any) => …)`) is intentionally **out of scope** — it has a coupled constraint (tightening the tools' `z.any()` output schemas breaks on int8-as-string) and is handled as a follow-up.

## Capabilities

### New Capabilities
- `raw-query-rows`: validated, wire-honest decoding of raw SQL query results — the `queryRows`/`queryRow` helpers, the zod row schema convention, and the pg int4/int8 decoding rules.

### Modified Capabilities
- None — this is a data-access-layer refactor; no existing spec requirement changes.

## Impact

- **New module**: `app/data/rows.ts` (helper + error wrapper).
- **Migrated**: `app/data/` files using `db.exec` with casts — `appointments.ts`, `offerings-queries.ts`, `webhook-requests.ts`, `report1.ts`, `notifications.ts`, `appointment.ts`, `uploads.ts`, `admin-lists.ts`, `admin-messages.ts`, `pdf.ts`, `user-summary-rows.ts`, `appointofferings.ts`, `offering-configs.ts`, `offering-configs-queries.ts`, `admin-dashboard.ts`, `app-webhook.ts`, `callback.ts`, `lists.ts`, `maintenance.ts`, and related consumers.
- **Corrected consumer**: `app/actions/verwaltung/appointments/controller.tsx` (`parseInt(row.id)` removal).
- **Dependencies**: `zod` (already a dependency); `remix/data-table` `db.exec`/`sql` unchanged.
- **Tests**: new `app/data/rows.test.ts`; existing query tests keep asserting behavior, now through validated rows.