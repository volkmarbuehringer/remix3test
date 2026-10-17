# Observability with PostgresStore

**Source:** `mastra-observability-postgres-store`

## The delta

The Mastra Studio quickstart and documentation examples show wiring observability with `MastraCompositeStore`, `LibSQLStore`, and `DuckDBStore`:

```typescript
storage: new MastraCompositeStore({
  default: new LibSQLStore({ url: 'file:./mastra.db' }),
  domains: {
    observability: await new DuckDBStore().getStore('observability'),
  },
}),
```

Adding DuckDB and LibSQL as additional dependencies when you're on Postgres is wasteful: **`PostgresStore` extends `MastraCompositeStore` internally and composes **all** domain classes including `ObservabilityPG`.** The observability domain tables already exist in your Postgres database — they're created by `PostgresStore.init()`.

So to add observability to a PostgresStore-backed Mastra you only need to install `@mastra/observability` and wire `Observability` + `MastraStorageExporter` into the existing `Mastra()` constructor — no storage changes, no DuckDB, no LibSQL, no second connection. The `MastraStorageExporter` writes traces, metrics, and logs to the observability domain tables in your existing Postgres database.

The repo's live wiring is `app/actions/mastra/index.ts`; the full constructor shape is covered by the vendor `mastra` skill (`.agents/skills/mastra/`) and `@mastra/observability` docs.

## What you get in Studio

- **Traces**: Every `agent.generate()` call is a trace with spans for LLM calls, tool executions, and steps
- **Metrics**: Agent runs, token counts, cost estimates, latency p50/p95
- **Logs**: Forwarded Pino logs correlated to traces

## Caveats

- **SensitiveDataFilter only redacts by key name** (`password`, `token`, `secret`, etc.) — free-form PII in message bodies is not scrubbed
- **No sampling by default** — 100% of spans are persisted. For production, add `sampling: { type: 'ratio', probability: 0.1 }`
- **Postgres is not optimal for high-volume observability** — at roughly 1,500 spans/sec sustained, switch to DuckDB (local) or ClickHouse (production)
- **"Save to dataset" from traces** saves Mastra internal message objects — not valid `agent.generate()` input. Create dataset items manually with plain string inputs
