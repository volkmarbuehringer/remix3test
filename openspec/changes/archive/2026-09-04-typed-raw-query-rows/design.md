## Context

Raw SQL through `db.exec` returns `rows?: Record<string, unknown>[]` by design (vendor `data-table/src/lib/driver.ts`). The data layer has ~40 cast sites across ~18 files in `app/data/` (plus the Mastra tools), all force-casting onto hand-written interfaces that drift from the actual pg wire shape — `id`/`*_id` are typed `string` but the columns are `int4` (pg returns `number`), and `WebhookRequestRow.created_at` is typed `number` but the column is `int8` (pg returns `string`). Consumers compensate, e.g. `parseInt(row.id)` at `app/actions/verwaltung/appointments/controller.tsx:213`. See proposal.md — Why.

Constraints shaping the approach:
- `zod` v4 is already a dependency (used by the Mastra tools); the form layer uses `remix/data-schema` (different tool, untouched here).
- `db.exec` accepts `string | SqlStatement`; the `sql` tag produces `SqlStatement` with `text` + `values`.
- pg type split: `int4` → `number`, `int8` → `string`. Aggregates over int8 (`count(*)`, `MIN`/`MAX`/`SUM`/`AVG`) also come back as strings.
- The data-table typed query API returns *domain* rows (after `afterRead`/`parseIntFields`); raw `db.exec` returns *wire* rows (no hooks). Two distinct row universes currently blurred by casts.

## Goals / Non-Goals

**Goals:**
- A small validated row-decoding helper in the data layer, with a thin error wrapper that names the failing query.
- Per-query zod row schemas co-located with their queries, replacing the hand-written row interfaces; row types derived via `z.infer`.
- Wire-honest decoding (int4 → number, int8 → string) with `z.coerce.number()` for aggregates.
- Migrate the `app/data/` raw-SQL call sites; correct the known drift as schemas land.

**Non-Goals:**
- Migrating the Mastra tool row mapping (`rows.map((r: any) => …)`) — coupled to tightening their `z.any()` output schemas, which breaks on int8-as-string (`validateToolOutput`); a follow-up.
- Changing the vendor `remix/data-table` API or upstreaming the helper.
- Retyping the data-table *domain* row universe (`TableRow<…>`), which stays as-is.

## Decisions

### D1. Helper shape and home
`app/data/rows.ts` (data-layer concern, narrowest owner) exports:

```ts
queryRows<Schema extends z.ZodType>(db: Database, stmt: SqlStatement | string, schema: Schema): z.infer<Schema>[]
queryRow<Schema extends z.ZodType>(db: Database, stmt: SqlStatement | string, schema: Schema): z.infer<Schema> | undefined
```

Both wrap `db.exec`, then `schema.parse(row)` per row. `queryRow` returns `undefined` on zero rows. Single-row `RETURNING id` casts become `queryRow(db, sql\`…\`, z.object({ id: z.number() }))`.

- Alternative: `app/utils/` — rejected; generic dumping ground per AGENTS.md.
- Alternative: `z.array(schema).parse(rows)` in one shot — rejected; per-row parse gives the wrapper better error context (which row).

### D2. Validation is runtime, with a thin wrapper
Rows are `schema.parse`d (not `safeParse`); a mismatch throws a wrapper error naming the statement text and the row index, so drift surfaces loudly in dev/test instead of shipping wrong data. The wrapper is thin — no retry, no fallback.

- Alternative: type-only `queryRows<T>` (centralized cast) — rejected; validation is the entire point (it would have caught the `id: string` lie).

### D3. Wire-honest schemas, coerce only aggregates
Row schemas mirror the pg mapping: `id: z.number()`, `date: z.string()`, `start_min: z.number()`, etc. Only aggregate expressions use `z.coerce.number()`, because a string `count` is never useful and `Number(count ?? 0)` is already ubiquitous.

- Alternative: coerce all int8 to number (normalized domain rows) — rejected; high churn, changes interface semantics, and conflates the two row universes again.

### D4. Schemas replace interfaces
Each hand-written interface (`AppointmentRow`, `AppointmentsNewRow`, `OfferingRow`, `WebhookRequestRow`, `Report1Row`, `ResourceOption`, …) is deleted; callers use `type X = z.infer<typeof xSchema>`. The schema is the single source of truth.

### D5. Phased migration, `app/data/` first
Land the helper + tests, then migrate file-by-file (each query keeps its behavior; tests guard it), then remove the `parseInt` workaround, then typecheck + full suite. Mastra is a tracked follow-up, not part of this change.

## Risks / Trade-offs

- **Runtime validation cost per row** → negligible at admin page sizes (~15 rows); no measurable impact.
- **A wrong schema 500s the request** → intended; caught in dev/test by the existing query test suite; the wrapper names the query so the fix is immediate.
- **`z.coerce.number()` masks an int8 string** → deliberate and documented at the schema; wire-honest schemas keep the raw string where it matters.
- **Broad migration surface** → phased per-file; each file's existing tests assert the same behavior through validated rows.
- **`notifications.ts:61` casts raw rows to the domain `Notification` type** → must switch to a wire schema (int8 fields as strings); the domain `TableRow<…>` type stays for the typed query API only.

## Migration Plan

1. Add `app/data/rows.ts` (helpers + error wrapper) and `app/data/rows.test.ts`.
2. Migrate `app/data/` files one at a time, co-locating schemas and deleting interfaces.
3. Remove the `parseInt(row.id)` workaround; fix downstream types where the corrected `id: number` simplifies call sites.
4. Run `npm run typecheck`, `npm test`, `npm run lint`.
5. (Follow-up) Mastra tools: normalize int8 fields at the row boundary, then tighten `z.any()` output schemas.

## Open Questions

None — the remaining unknowns are implementation details that do not change the spec, approach, or task breakdown.