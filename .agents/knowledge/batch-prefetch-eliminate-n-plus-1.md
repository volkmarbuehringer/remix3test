---
title: "Batch Pre-Fetch to Eliminate N+1 Queries"
tags: [database, postgres, performance, optimization]
created: 2026-06-03
status: active
---

## Problem

A loop iterating over 7 days called `offeringExists()` per iteration — each call executed `SELECT 1 FROM appointoffering WHERE ... LIMIT 1`. This is the classic N+1 anti-pattern: 1 query to determine the work items, then N more queries (one per item). Each round-trip adds latency and connection pressure.

## Solution

Replace the per-item check with a single range query that fetches all candidate rows up front, then use an in-memory Set for membership checks:

```ts
// Single batch query for the entire week
async function listExistingOfferingKeys(pool, resourceId, mondayMs) {
  let sundayMs = mondayMs + 7 * 86_400_000
  let result = await pool.query(
    `SELECT day, lower(during) AS start_min, upper(during) AS end_min
     FROM appointoffering
     WHERE resource_id = $1 AND day >= $2 AND day < $3`,
    [resourceId, mondayMs, sundayMs],
  )
  let keys = new Set<string>()
  for (let row of result.rows) {
    keys.add(`${row.day}:${row.start_min}:${row.end_min}`)
  }
  return keys
}

// In the loop: O(1) membership check instead of DB query
let existingKeys = await listExistingOfferingKeys(pool, resourceId, mondayMs)
for (let i = 0; i < 7; i++) {
  // ...
  if (existingKeys.has(`${dayMs}:${startMin}:${endMin}`)) { skipped++; continue }
  // ...
}
```

## Why

- **Latency**: 7 sequential DB round-trips become 1. In a remote DB scenario, this saves hundreds of ms.
- **Connection efficiency**: 1 query uses 1 pool connection instead of churning through 7.
- **Set membership**: `Set.has()` is O(1) in-memory — negligible compared to any DB query.
- **Composite key pattern**: Using `${day}:${start}:${end}` as a Set key works for small, bounded data. For larger datasets, consider a Map or Bloom filter.
