---
name: static-element-waitfor-content-not-existence
description: "Use when waitFor(() => !!getElementById(x)) passes instantly but the next assertion fails on empty content — the element is now statically present in the fixture; wait for its content instead."
metadata:
  origin: auto-extracted
---

# Static container breaks existence-based waitFor

**Extracted:** 2026-09-15
**Context:** Refactoring a confirm-gate from a dynamically-created element into a statically-present container in the page fixture broke two browser tests.

## Problem
Existence-check waits (`!!getElementById(x)`) break when an element changes from dynamically-created (only created when content is ready) to statically-present in the DOM/fixture. The wait passes instantly on the empty shell, and the following `textContent` assertion fails with a confusing "not found" error.

## Solution
Wait for the element to have the actual content you're about to assert, not just to exist:

```ts
await waitFor(() => {
  let gate = document.getElementById('ae-confirm-gate')
  return !!gate && gate.textContent?.includes('Cancel Jane Doe?')
})
```

The `waitFor` predicate should overlap the assertion that follows — if you assert on `textContent`, wait on `textContent`.

## When to Use
- Refactoring a dynamically-created DOM node into a static container/placeholder
- A `waitFor` existence check passes instantly but the next assertion fails on empty content
- Flaky "element not found" failures after moving fixture markup around