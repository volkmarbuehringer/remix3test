<!-- Context: remix3/concepts/ui-building | Priority: high | Version: 1.0 -->

# Concept: Remix UI Building

**Core Idea**: Build UI using Remix Component model with two-phase lifecycle (setup once, render on updates). Use host-element mixins for behavior instead of legacy props.

## Key Points

- Two-phase component: setup runs once, render function runs on every update
- State in setup scope as plain JS variables, call `handle.update()` explicitly
- Use mixins over host props: `mix={[on(...), css(...), ref(...), keysEvents(), pressEvents(), link()]}`
- Global listeners via `addEventListeners(target, handle.signal, listeners)`
- Post-render work via `queueTask(...)` for hydration-sensitive setup
- Keep `<head>` explicit in document/layout code

## Quick Example

```tsx
function Counter({ initial = 0 }) {
  let count = initial

  const setup = (handle) => {
    handle.update = () => {
      count++
      render() // manual update trigger
    }
  }

  return (
    <button mix={[pressEvents()]} onPress={setup.handle.update}>
      {count}
    </button>
  )
}
```

## Reference

- Component model: `lookup/component-model.md`
- Mixins: `lookup/mixins-styling-events.md`
- Hydration: `lookup/hydration-frames-navigation.md`
- Full skill: `~/remix/skills/remix-ui/SKILL.md`