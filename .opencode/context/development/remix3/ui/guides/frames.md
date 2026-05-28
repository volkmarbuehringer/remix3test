<!-- Context: development/remix3/guides | Priority: high | Version: 1.0 | Updated: 2026-04-25 -->

# Frames

Stream server content into the page with independent loading and reloading.

## Core Idea

`<Frame src="/url" fallback={JSX} />` renders server content. Blocking frames wait for content; non-blocking frames show fallback immediately then stream in.

## Key Points

- `src` (required) - URL to fetch frame content
- `fallback` (optional) - Without it, frame blocks; with it, frame streams progressively
- `name` (optional) - Register for lookup via `handle.frames.get(name)`
- `handle.frame.reload()` - Re-fetch current frame, diff DOM, preserve component state
- Nested frames hydrate independently
- `renderToStream` uses `resolveFrame(src)` to fetch frame HTML

## Quick Example

```tsx
function App() {
  return () => (
    <div>
      <Frame src="/sidebar" fallback={<div>Loading...</div>} />
      <Frame src="/main" />
    </div>
  )
}

// Reload adjacent frame
function CartRow(handle) {
  return () => (
    <button onClick={async () => {
      await handle.frames.get('cart-summary')?.reload()
      await handle.frame.reload()
    }}>Update</button>
  )
}
```

## Reference

`/home/lucky/remix/packages/component/docs/frames.md`