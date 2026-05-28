# Frames

**Core Idea**: `<Frame src="/path">` streams partial server UI into the page. Frames can stack, nest, be reloaded without full-page navigation, and contain client entries.

**Key Points**:
- **Blocking** (no `fallback`): server waits for frame content before sending initial HTML
- **Non-blocking** (with `fallback`): fallback renders immediately, real content streams in later
- Server `resolveFrame(src, target, context)` returns HTML string or `ReadableStream`
- `handle.frame.reload()` re-fetches frame src, diffs content in, preserves client entry state
- `handle.frames.get(name)` and `handle.frames.top.reload()` for cross-frame and root reloads
- Client `resolveFrame(src, signal, target)` handles refresh and initial hydration of pending frames
- Frame content itself is rendered with `renderToStream` — frames nest recursively

**Minimal Example**:
```tsx
<Frame src="/sidebar" fallback={<div>Loading...</div>} />
<Frame src="/main-content" />
```

**Reference**: `~/remix/packages/ui/docs/frames.md`
