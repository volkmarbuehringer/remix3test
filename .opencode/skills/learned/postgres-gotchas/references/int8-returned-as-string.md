# node-postgres Returns `BIGINT`/`int8` Columns as Strings

**Source:** node-postgres `int8` return-type behavior

> Cross-reference: the raw-SQL consumption side of this (wrapping `Number()` around `BIGINT` values from `pool.query`/`db.exec`) is covered in `database-gotchas` (`references/database-errors.md`). This part is the **schema/validation** side: Zod and Mastra `outputSchema`.

## Problem

node-postgres (`pg`) returns PostgreSQL `BIGINT` (`int8`) columns as **strings**, not numbers. This is a documented driver behavior: Postgres `int8` values can exceed the JS safe-integer range, so `pg` hands them back as a `string` rather than a `number`. `int4` columns still come back as numbers.

This silently breaks any strict numeric validation placed on a field sourced from an `int8` column. The classic, hard-to-spot case is a Zod schema expecting `z.number()` for a timestamp/date field (`created_at`, `updated_at`, `date`, `disabled_at`), e.g. a Mastra `createTool` `outputSchema`:

```ts
// ❌ Typechecks fine, but fails at RUNTIME because the node-postgres value is a
// string like "1705276800000", not a number.
createdAt: z.number().describe('Creation unix ms'),
```

When Mastra's `validateToolOutput` enforces the `outputSchema`, the tool throws `Tool output validation failed ... expected number, received string`. The failure only appears at runtime (not typecheck) and varies by column width — `int4` → number, `int8` → string — so it's easy to misdiagnose as a "data bug."

## Solution

For fields sourced from `int8` columns (bigints, unix-ms timestamps), accept either a number or a string, or use a permissive type when the exact type isn't load-bearing:

```ts
// ✅ Accept both (pg may return string or number depending on column width)
createdAt: z.union([z.number(), z.string()]).describe('Creation unix ms'),
// Or, when the type isn't used for logic:
createdAt: z.any().describe('Creation unix ms'),
```

Also confirm the schema **matches the runtime shape** (required fields present; optional for conditionally-absent ones). A `createTool`'s generic infers the `execute` return from `outputSchema`, so a mismatch — e.g. `z.discriminatedUnion('found', ...)` against `execute` returns with untyped DB-row fields — fails at **typecheck** with TS2322. Prefer a lenient `z.object` with `.optional()` entity fields over a strict discriminated union when the return includes untyped DB rows.

Two related Zod 4 details that surface in the same code:

- `z.record(valueSchema)` is a TS2554; Zod 4 requires `z.record(keySchema, valueSchema)` — use `z.record(z.string(), z.number())`.

## When to Use

- A Zod schema / Mastra `outputSchema` uses `z.number()` for a field sourced from a Postgres `int8`/`BIGINT` column and fails at runtime with `expected number, received string`.
- A tool validates at typecheck but fails at runtime only on the DB-backed path.
- You're building a schema that must tolerate both `number` and `string` for bigint/timestamp fields.
