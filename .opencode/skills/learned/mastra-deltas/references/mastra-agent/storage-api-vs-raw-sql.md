# Use Storage API Instead of Raw SQL When API Has Side-Effects

**Source:** `mastra-storage-api-vs-raw-sql`

## Problem

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

## Solution

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
