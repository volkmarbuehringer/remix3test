---
name: epoch-ms-granularity-comparison
description: "When filtering stored UTC-midnight epoch ms dates, compare against the same granularity — not wall-clock Date.now()"
user-invocable: false
origin: auto-extracted
---

# Epoch-ms Granularity Comparison: UTC Midnight vs Wall-Clock

**Extracted:** 2026-06-11
**Context:** Remix 3 appointment filtering — `a.date >= Date.now()` silently excluded today's appointments because the column stores UTC-midnight epoch ms while `Date.now()` returns wall-clock time.

## Problem

When you store dates as **UTC-midnight epoch ms** (e.g., `Date.UTC(2026, 5, 11)` for June 11) and then filter for "future" entries with `stored_date >= Date.now()`, **today's entries are silently excluded** at any time past midnight UTC.

This happens because `Date.now()` returns the current wall-clock timestamp (e.g., `1768046400000` for noon on June 11), which is always greater than the midnight value for the same day (`1768003200000`). The comparison `midnight >= noon` is `false`.

The bug is silent — no error, no exception — just missing data.

```ts
// ❌ BUG: Excludes today's entries
let now = Date.now()
query += ` AND a.date >= $${paramIndex}`
params.push(now)

// a.date for today = Date.UTC(2026, 5, 11) = 1768003200000
// Date.now() at noon    =                      1768046400000
// 1768003200000 >= 1768046400000 → false → today's entry filtered out
```

## Solution

Compare against **today's UTC midnight** instead of wall-clock time:

```ts
// ✅ Correct: compare against same granularity
let now = new Date()
let todayUtcMidnight = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
query += ` AND a.date >= $${paramIndex}`
params.push(todayUtcMidnight)
```

For the **expired/past** filter, the same principle applies — use `< todayUtcMidnight` instead of `< Date.now()` to correctly exclude today:

```ts
if (status === 'pending' || !status) {
  query += ` AND a.date >= $${paramIndex}`
  params.push(todayUtcMidnight)   // includes today and future
} else if (status === 'expired') {
  query += ` AND a.date < $${paramIndex}`
  params.push(todayUtcMidnight)   // excludes today (yesterday and older only)
}
```

## When to Use

- You have a database column storing dates as epoch ms (BIGINT) at UTC day boundaries
- You're writing a SQL `WHERE` clause that filters by "future" or "past" dates
- You see `Date.now()` used as a filter boundary against a stored date column
- You're reviewing code that compares timestamps at different granularities (day-boundary vs millisecond-precision)
