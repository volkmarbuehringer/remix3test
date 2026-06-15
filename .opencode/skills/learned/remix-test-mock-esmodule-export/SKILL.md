---
name: remix-test-mock-esmodule-export
description: "`mock.method` cannot spy on named ES module exports (frozen namespace). Test via side effects or wrap in an object instead."
user-invocable: false
origin: auto-extracted
---

# Remix 3: Mocking ES Module Named Exports in Tests

**Extracted:** 2026-06-15
**Context:** Tests for a `clientEntry` component that imports `lockScroll` from `remix/ui/scroll-lock`. Attempting `mock.method(scrollLockModule, 'lockScroll', fake)` failed with `Cannot assign to property 'lockScroll' of [object Module]`.

## Problem

`mock.method(obj, methodName, impl?)` from `@remix-run/test` replaces `obj[methodName]` with a spy. But when `obj` is an ES module namespace object (e.g., `import * as scrollLock from 'remix/ui/scroll-lock'`), the assignment silently fails in sloppy mode or throws `Cannot assign to property 'X' of [object Module]` in strict mode — ES module namespaces are frozen by the JS runtime.

This means you **cannot** spy on named exports from a third-party or framework module using `mock.method`:

```ts
import * as scrollLock from 'remix/ui/scroll-lock'

// ❌ Throws: Cannot assign to property 'lockScroll' of [object Module]
mock.method(scrollLock, 'lockScroll', () => () => {})
```

The same applies to any named ES module export — any module imported with `import { X }` or `import * as NS`.

## Solution

Two strategies, both of which avoid the frozen namespace problem:

### Strategy 1: Test via DOM side effects (preferred for DOM-manipulating functions)

Instead of mocking the function, set up a realistic enough DOM mock that the real function can execute, then assert on the DOM side effects.

```ts
import { lockScroll } from 'remix/ui/scroll-lock'
import { MyComponent } from './my-component.tsx'

describe('MyComponent', () => {
  let documentElementStyle: Record<string, string>

  function setupDom() {
    documentElementStyle = { overflow: '', scrollbarGutter: '' }

    let view = {
      scrollX: 0,
      scrollY: 100,
      scrollTo: () => {},
      getComputedStyle: () => ({ scrollbarGutter: 'auto' }),
      innerWidth: 1024,
    }

    ;(globalThis as any).document = {
      body: {},
      defaultView: view,
      documentElement: { style: documentElementStyle, clientWidth: 1000 },
    }
  }

  it('locks scroll when activated', () => {
    setupDom()

    // Initialize the component — the real lockScroll() runs
    let handle = {} as any
    let initFn = (MyComponent as any)(handle)
    initFn()

    // Assert on the DOM side effect rather than mocking the function
    assert.equal(documentElementStyle.overflow, 'hidden')
  })
})
```

The key insight: `lockScroll()` (and similar functions) check `globalThis.document` at runtime. If you provide a mock `document` with the properties they need (`body`, `documentElement.style`, `defaultView`), the real function runs and produces observable side effects.

### Strategy 2: Wrap import in a mutable object (when side-effect testing is impractical)

For functions that don't produce DOM side effects (pure computation, API calls), wrap the module in an object so `mock.method` can mutate it:

```ts
// app/lib/fetch-wrapper.ts
import { someApi } from 'some-module'
export const api = { someApi }
```

```ts
// In your test:
import { mock } from 'remix/test'
import { api } from '../lib/fetch-wrapper.ts'

it('calls the API', () => {
  let spy = mock.method(api, 'someApi', () => 'fake')
  // ...
  spy.mock.restore?.()
})
```

This works because `api` is a plain object, not a frozen ES module namespace.

## Error Recognition

```
Cannot assign to property 'lockScroll' of [object Module]
```

This exact error means you're trying to `mock.method` on an ES module namespace. Switch to Strategy 1 or 2.

## When to Use

- `mock.method(moduleExport, ...)` throws `Cannot assign to property 'X' of [object Module]`
- Testing components that import functions from `remix/ui/*`, `remix/*`, or any third-party ES module
- Writing `@remix-run/test` tests where you need to verify a module function was called
