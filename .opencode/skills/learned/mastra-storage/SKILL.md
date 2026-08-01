---
name: mastra-storage
description: 'Mastra storage and observability — PostgresStore-backed observability without DuckDB, and using the storage API instead of raw SQL for side-effect cleanup'
origin: consolidated
---

# Mastra Storage & Observability Patterns

**Consolidated from:** `mastra-observability-postgres-store`, `mastra-storage-api-vs-raw-sql`

Covers two aspects of Mastra persistence:
1. Wiring `@mastra/observability` into a PostgresStore-based Mastra without DuckDB or a separate connection
2. Using the storage API (e.g., `Memory.deleteThread`) instead of raw SQL when the API has side effects

---

## Part 1: Observability with PostgresStore

### Problem

The Mastra Studio quickstart and documentation examples show wiring observability with `MastraCompositeStore`, `LibSQLStore`, and `DuckDBStore`. This creates unnecessary complexity when you're already using `PostgresStore`.

The standard example looks like:

```typescript
storage: new MastraCompositeStore({
  default: new LibSQLStore({ url: 'file:./mastra.db' }),
  domains: {
    observability: await new DuckDBStore().getStore('observability'),
  },
}),
```

Adding DuckDB and LibSQL as additional dependencies when you're on Postgres is wasteful. You need to know whether PostgresStore already handles this.

### Solution

`PostgresStore` extends `MastraCompositeStore` internally and composes **all** domain classes including `ObservabilityPG`. The observability domain tables already exist in your Postgres database — they're created by `PostgresStore.init()`.

To add observability to a Mastra instance using PostgresStore:

1. Install `@mastra/observability`:

```sh
pnpm add @mastra/observability
```

2. Wire `Observability` + `MastraStorageExporter` into the existing `Mastra()` constructor with no storage changes:

```typescript
import { Mastra } from '@mastra/core'
import { PinoLogger } from '@mastra/loggers'
import { Observability, MastraStorageExporter, SensitiveDataFilter } from '@mastra/observability'

export const mastra = new Mastra({
  // ... existing config: agents, storage, logger ...
  storage: new PostgresStore({
    id: 'mastra',
    pool, // your existing pg pool
  }),
  observability: new Observability({
    configs: {
      default: {
        serviceName: 'my-app',
        exporters: [new MastraStorageExporter()],
        spanOutputProcessors: [new SensitiveDataFilter()],
      },
    },
  }),
})
```

That's it. No DuckDB, no LibSQL, no second connection. The `MastraStorageExporter` writes traces, metrics, and logs to the observability domain tables in your existing Postgres database.

### What you get in Studio

- **Traces**: Every `agent.generate()` call is a trace with spans for LLM calls, tool executions, and steps
- **Metrics**: Agent runs, token counts, cost estimates, latency p50/p95
- **Logs**: Forwarded Pino logs correlated to traces

### Caveats

- **SensitiveDataFilter only redacts by key name** (`password`, `token`, `secret`, etc.) — free-form PII in message bodies is not scrubbed
- **No sampling by default** — 100% of spans are persisted. For production, add `sampling: { type: 'ratio', probability: 0.1 }`
- **Postgres is not optimal for high-volume observability** — at roughly 1,500 spans/sec sustained, switch to DuckDB (local) or ClickHouse (production)
- **"Save to dataset" from traces** saves Mastra internal message objects — not valid `agent.generate()` input. Create dataset items manually with plain string inputs

---

## Part 2: Use Storage API Instead of Raw SQL When API Has Side-Effects

### Problem

Direct SQL deletion of storage-layer tables couples the app to private schema details and silently orphans related data:

```ts
// BAD: bypasses Memory API, orphans vector embeddings
await context.db.exec(sql`DELETE FROM mastra_messages WHERE thread_id = ${id}`)
await context.db.exec(sql`DELETE FROM mastra_threads WHERE id = ${id}`)
```

Problems:

- Table/column names can change between library releases
- Deletes are non-atomic (no transaction across tables)
- Vector embeddings in the vector store are orphaned
- Any future clean-up logic added to the API is skipped

### Solution

Use the dedicated API method, which handles all cleanup:

```ts
// GOOD: clean, atomic, future-proof
let agent = mastra.getAgent('supportAgent')
let memory = await agent.getMemory()
if (memory) {
  await memory.deleteThread(id)
}
```

If raw SQL is unavoidable (e.g., bulk operations), wrap all deletes in a transaction and document the coupling risk.

---

## When to Use

- Adding observability to an existing Mastra + PostgresStore setup
- Avoiding unnecessary DuckDB/LibSQL dependencies when on Postgres
- Setting up local development observability that matches production (both on Postgres)
- Debugging agent behavior via trace inspection in Studio
- Deleting records from a library-managed storage layer (Mastra Memory, ORM-managed tables, etc.)
- When the library provides a `delete`, `remove`, or `destroy` method for the same operation
- Always prefer the highest-level API available

## Related Skills

- `mastra-agent` — agent construction and `memory.recall()` output normalization
- `postgres-patterns` — general PostgreSQL schema and query patterns
- `ddl-migration-dedicated-client` — running DDL migrations without pool timeouts
