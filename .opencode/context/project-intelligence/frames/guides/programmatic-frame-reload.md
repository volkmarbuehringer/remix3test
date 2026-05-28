# Guide: Programmatic Frame Reload

## Purpose

How to use `handle.frame.reload()`, `handle.frames.top.reload()`, and
`handle.frame.src` in newapp for targeted frame refresh without full page
navigation.

## API Reference

| Method | Scope | Effect |
|--------|-------|--------|
| `handle.frame.reload()` | Current frame | Re-fetches the frame's `src` and replaces content. Client entries inside keep local state. |
| `handle.frames.top.reload()` | Document root | Reloads the entire document tree. Persistent client entries survive; removable ones are disposed. |
| `handle.frames[name].reload()` | Named sibling | Reloads a specific named frame from within any client entry. |
| `handle.frames.top.src = url` | Document root | Changes the root document's URL before calling `.reload()`. |

## Patterns in newapp

### Inline Refresh Button (Client Grid)

The `FrameRefreshButton` in `app/assets/grid-refresh-button.tsx` calls
`handle.frame.reload()` to refresh just the grid frame:

```tsx
// Inside a client entry within the grid frame:
<button on:click={async () => {
  let signal = await handle.frame.reload()
  if (signal.aborted) return
  // frame content has been refreshed
}}>
  ↻ Refresh
</button>
```

### Post-CRUD Auto-Refresh (Client Grid)

The `GridAutoRefresh` in `app/assets/grid-auto-refresh.tsx` triggers
after a redirect from create/edit/delete:

```tsx
// Rendered after CRUD redirect, reloads the named frame:
handle.frames['client-grid']?.reload()
```

### Doc-Level Navigation from Inside a Frame

The `AdminViewToggle` in `app/assets/admin-view-toggle.tsx` demonstrates
changing the root URL and reloading:

```tsx
handle.frames.top.src = '/admin/chatlog'
let signal = await handle.frames.top.reload()
```

## Key Points

- `handle.frame.reload()` only refreshes the frame's own content — parent page
  and sibling frames are untouched
- The `AbortSignal` returned by `.reload()` can be checked via `signal.aborted`
  to detect if the reload was preempted by another action
- Client entries inside a reloaded frame do NOT re-hydrate (per frame boundary
  behavior) — their local state is preserved
- Always guard concurrent reload calls with a pending flag to prevent
  double-fetches

## See Also

- `concepts/frame-boundary-hydration.md` — why client entries inside frames
  don't re-hydrate on parent reload
- `guides/client-entry-in-paginated-lists.md` — handling props in interactive
  entries inside frames
- `guides/root-reload-lifecycle.md` — persistent vs removable entries
