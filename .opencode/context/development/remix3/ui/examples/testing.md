# Example: Testing Components

**Core Idea**: Use `createRoot()` and `root.flush()` for component unit tests.

**Quick Example**:
```tsx
import { createRoot } from 'remix/ui'
import { describe, it } from 'remix/test'
import * as assert from 'remix/assert'

describe('Counter', () => {
  it('renders and responds to clicks', () => {
    let container = document.createElement('div')
    let root = createRoot(container)

    root.render(<Counter />)
    root.flush()

    container.querySelector('button')?.click()
    root.flush()

    assert.ok(container.textContent?.includes('1'))
  })
```

**Guidelines**:
- Flush after initial render (listeners/queued tasks attach)
- Flush after interactions calling `handle.update()`
- Flush after async work resolves
- Use `root.dispose()` to verify cleanup

**High-Value Patterns**:
- Minimal component state
- Work in event handlers first
- Use `queueTask` for post-render work
- Prefer browser/CSS state over JS state for hover/focus

**Reference**: [packages/component/docs](https://github.com/remix-run/remix/tree/main/packages/component/docs)