<!-- Context: development/remix3/ui | Priority: critical | Version: 1.0 | Updated: 2026-04-25 -->

# remix-ui Skill

Build Remix app UI using Remix Component - two-phase component model with host-element mixins.

## Core Idea

Remix Component uses two phases: setup runs once, render runs on every update. Compose behavior with `mix={[on(...), css(...), ref(...)]}` on host elements.

## Key Points

- Two-phase shape: setup function → returned render function
- State in setup scope as plain JS variables, call `handle.update()` explicitly
- Compose behavior with `mix` instead of legacy host props
- Use `addEventListeners(target, handle.signal, listeners)` for global listeners
- Use `queueTask(...)` for post-render DOM work
- Keep `<head>` explicit in document/layout code
- Test with `root.flush()` for synchronous assertions

## Mixins Reference

| Mixin | Purpose |
|-------|---------|
| `on(type, handler)` | DOM event listener |
| `css({ ... })` | Static stylesheet rules |
| `ref(fn)` | DOM node access |
| `pressEvents()` | Pointer + keyboard activation |
| `keysEvents()` | Key-specific host events |
| `link(href)` | Remix navigation link |
| `animateEntrance/exit/layout()` | Animation mixins |

## Quick Example

```tsx
import { on, css } from 'remix/ui'
import type { Handle } from 'remix/ui'

function Counter(handle: Handle<{ label: string }>, initial = 0) {
  let count = initial

  return () => (
    <button
      mix={[
        on('click', () => { count++; handle.update() }),
        css({ color: 'blue', '&:hover': { color: 'darkblue' } }),
      ]}
    >
      {handle.props.label}: {count}
    </button>
  )
}
```

## Reference Files

- `lookup/component-model.md` - Component shape, state, handle
- `lookup/mixins-styling-events.md` - Events, refs, styling
- `lookup/hydration-frames-navigation.md` - clientEntry, run, frames, head
- `lookup/testing-patterns.md` - Unit tests with root.flush()
- `lookup/animate-elements.md` - Enter/exit/layout animations
- `lookup/create-mixins.md` - Authoring reusable mixins

## Source

`/home/lucky/remix/skills/remix-ui/SKILL.md`