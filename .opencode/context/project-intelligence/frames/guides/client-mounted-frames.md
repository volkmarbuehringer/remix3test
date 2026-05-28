# Guide: Client-Mounted Frames

## Purpose

How to dynamically mount and unmount `<Frame>` components from within
`clientEntry` functions in newapp for lazy-loaded content panels.

## Pattern

The key insight: a `<Frame>` can be conditionally rendered inside a
`clientEntry` function using a boolean state variable. The `run()` runtime
automatically handles mounting (when `<Frame>` enters the virtual tree) and
unmounting (when it leaves, the frame is disposed).

```
Client Entry (boolean state)
  ├── showFrame = false  →  render null          (Frame not in DOM)
  └── showFrame = true   →  render <Frame>       (Frame mounts + resolves src)
                               └── fallback shown while loading
                               └── server content streams in
                                    └── nested frames resolve independently
```

## Examples in newapp

### AI Agent Result Toggle

`app/assets/ai-agent-result-toggle.tsx` mounts a result frame on "Run Agent"
click:

```tsx
export const AiAgentResultToggle = clientEntry(
  import.meta.url,
  function AiAgentResultToggle(handle: Handle) {
    let showResult = false

    return () => (
      <div>
        {!showResult ? (
          <button on:click={() => { showResult = true; handle.update() }}>
            ▶ Run Agent
          </button>
        ) : (
          <button on:click={() => { showResult = false; handle.update() }}>
            ✕ Close Result
          </button>
        )}

        {showResult ? (
          <Frame
            name="ai-agent-result"
            src="/ai/fragments/agent-result?prompt=..."
            fallback={<div>Running agent…</div>}
          />
        ) : null}
      </div>
    )
  },
)
```

### Admin Chatlog Detail Toggle

`app/assets/chatlog-row-detail.tsx` mounts a detail frame on row click:

```tsx
<button on:click={() => { showDetail = !showDetail; handle.update() }}>
  {showDetail ? '✕ Close Detail' : '📄 Detail'}
</button>

{showDetail ? (
  <Frame
    name={`chatlog-detail-${conversationId}`}
    src={`/admin/chatlog/fragments/detail/${conversationId}`}
    fallback={<div>Loading conversation detail…</div>}
  />
) : null}
```

## Design Decisions

1. **Boolean state over CSS visibility** — Only render the `<Frame>` when
   needed. Avoid `display:none` because the frame still resolves its src
   even when hidden, wasting the server round-trip.

2. **Unique frame names** — When rendering frames in a list (like chatlog
   rows), always use a unique `name` like `chatlog-detail-${id}` to prevent
   state leakage across rows.

3. **Fallbacks are required** — Always provide a `fallback` prop. It renders
   immediately while the frame streams its server content, giving the user
   instant feedback.

## When to Use vs Direct Render

| Use Client-Mounted `<Frame>` | Use Direct `clientEntry` |
|------------------------------|-------------------------|
| Lazy-loading a panel on interaction | Always-visible interactive content |
| Content that loads slowly or optionally | Content needed on every render |
| Detail views, result panels, popovers | Buttons, toggles, counters |

## See Also

- `examples/cart-button-list-pattern.md` — why client entries inside frames
  need prop syncing
- `guides/programmatic-frame-reload.md` — how to refresh frame content
