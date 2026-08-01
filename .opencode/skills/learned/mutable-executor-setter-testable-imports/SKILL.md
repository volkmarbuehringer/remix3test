---
name: mutable-executor-setter-testable-imports
description: "Make ES module imports testable by storing references in a mutable variable with a setter function"
user-invocable: false
origin: auto-extracted
---

# Mutable Executor Setter for Testable ES Module Imports

**Extracted:** 2026-07-27
**Context:** Testing code that imports functions from another module and captures them in closures or maps at module-evaluation time. Without a mocking framework (jest.mock, vi.mock), these captured references cannot be replaced in tests.

## Problem

When a module imports functions at the top level and captures them in closures or lookup maps:

```ts
import { executeCancelUserWorkflow } from './workflow-executor.ts'

const EXECUTORS = {
  cancel: async (input) => {
    let r = await executeCancelUserWorkflow(input) // captured at module eval
    return { success: r.success }
  },
}
```

The function reference `executeCancelUserWorkflow` is captured in the closure when the module evaluates. Tests cannot replace it because:

1. ES module namespaces are frozen — you can't reassign named exports
2. `mock.method(namespace, 'fn', mock)` only works with namespace imports (`import * as`)
3. The reference is already captured — even if you replace the export, the closure still points to the original

## Solution

Store the mutable reference in a module-level variable and export a setter function:

```ts
// production.ts
type Executor = (input: Input) => Promise<Result>
let _executors: Record<string, Executor> = {}

export function __setExecutors(m: Record<string, Executor>): void {
  _executors = m
}

async function initExecutors(): Promise<void> {
  let { fn1, fn2 } = await import('./workflow-executor.ts')
  _executors = { a: fn1, b: fn2 }
}
initExecutors()

// handler reads from _executors, not from a closure
function handle(intent: string, input: Input) {
  let executor = _executors[intent]
  if (!executor) return { error: 'Unknown' }
  return executor(input)
}
```

In tests:

```ts
import { handler, __setExecutors } from './production.ts'

it('calls the right executor', () => {
  let captured = null
  __setExecutors({
    cancel: async (input) => {
      captured = input
      return { success: true }
    },
  })

  let result = handler('cancel', { id: 42 })

  assert.equal(result.success, true)
  assert.equal(captured.id, 42)
})
```

### Race condition prevention

If `initExecutors()` is async (calls `await import(...)`), there's a race between the async init resolving and `__setExecutors` being called. Guard with a flag:

```ts
let _ready = false

export function __setExecutors(m) {
  _executors = m
  _ready = true  // prevent initExecutors from overwriting
}

async function initExecutors() {
  if (_ready) return
  let mod = await import('./workflow-executor.ts')
  if (_ready) return
  _executors = { ... }
  _ready = true
}
initExecutors()
```

## When to Use

- Testing modules that import and capture external function references
- Test frameworks that don't support `jest.mock` / `vi.mock` (e.g. `remix/test`, `bun:test` without mocks, Node `node:test`)
- Keeping production code clean while enabling testability without DI frameworks
- Module-level async initialization that tests need to bypass
