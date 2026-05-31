<!-- Context: development/remix3/guides | Priority: low | Version: 1.0 | Updated: 2026-04-25 -->

# Testing

Test components with a headless DOM renderer.

## Core Idea

Import testing utilities to render components in a simulated DOM environment and assert on their behavior.

## Key Points

- Use `render(<Component />)` to mount component in test environment
- `screen` provides query helpers for finding elements
- Fire events with `fireEvent` or interaction helpers
- `handle.update()` triggers re-renders for state assertions
- `waitFor` waits for async rendering to settle

## Quick Example

```tsx
import { render, screen, fireEvent } from 'remix/ui/testing'
import { describe, it } from 'remix/test'
import * as assert from 'remix/assert'

describe('Counter', () => {
  it('increments count', () => {
    render(<Counter initialCount={0} />)
    assert.ok(screen.getByText('Count: 0'))

    fireEvent.click(screen.getByText('+'))
    assert.ok(screen.getByText('Count: 1'))
  })
```

## Reference

`/home/lucky/remix/packages/component/docs/testing.md`