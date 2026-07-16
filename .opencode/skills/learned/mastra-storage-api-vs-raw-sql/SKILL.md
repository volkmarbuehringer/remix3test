---
name: mastra-storage-api-vs-raw-sql
description: 'Use storage API (e.g. Memory.deleteThread) instead of raw SQL for thread deletion'
origin: auto-extracted
---

# Use Storage API Instead of Raw SQL When API Has Side-Effects

**Extracted:** 2026-07-06
**Context:** When a storage library's API (e.g., Mastra Memory) performs cleanup beyond simple row deletion (vector embeddings, caches, event hooks), raw SQL bypasses that cleanup.

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

## When to Use

- Deleting records from a library-managed storage layer (Mastra Memory, ORM-managed tables, etc.)
- When the library provides a `delete`, `remove`, or `destroy` method for the same operation
- Always prefer the highest-level API available
