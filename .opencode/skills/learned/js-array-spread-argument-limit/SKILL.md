---
name: js-array-spread-argument-limit
description: "Spreading arrays >~65k elements throws 'Maximum call stack size exceeded' — use a loop or concat"
user-invocable: false
origin: auto-extracted
---

# Array Spread Argument-Limit Overflow

**Extracted:** 2026-07-31
**Context:** A recursive directory walk (`result.push(...sub)`) threw `RangeError: Maximum call stack size exceeded` even though the directory tree was only 6 levels deep.

## Problem

Spreading an array into a call as separate arguments (`push(...arr)`, `Math.max(...arr)`, `fn(...arr)`, `arr2.push.apply(arr2, arr)`) throws `RangeError: Maximum call stack size exceeded` when the array exceeds the engine's argument-count limit (~65,535 in V8). The error message is misleading: it looks like a recursion-depth problem even on a shallow call tree. Recursive directory walks, list accumulation, and result merging silently hit this once data grows past the limit.

Example: a repo with 127k files; `collectEntries` doing `result.push(...sub)` overflowed from a depth-6 tree.

## Solution

Never spread potentially-large arrays. Push in a loop, or use `concat` (one array argument — no limit):

```ts
// BAD — RangeError when sub.length > ~65,535
result.push(...sub)

// GOOD
for (let entry of sub) {
  result.push(entry)
}

// also fine
result = result.concat(sub)
```

Other variants to avoid with large arrays:
- `Math.max(...arr)` / `Math.min(...arr)` → loop or `reduce`
- `fn(...args)` with unbounded `args` → loop or chunk
- `Promise.all(arr)` is fine (takes the array, no spread)

## When to Use

- Recursive file/directory tree walks that accumulate results
- Building large lists with `push(...items)` / `apply`
- Any "Maximum call stack size exceeded" on a shallow call tree — suspect spread/apply argument limits before chasing recursion depth
