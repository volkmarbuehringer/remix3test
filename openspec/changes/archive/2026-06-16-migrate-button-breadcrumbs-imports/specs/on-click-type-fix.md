# `on('click')` type error fix

## Files (1 file, 12 occurrences)

- `app/assets/lists-client.tsx` — lines 292, 295, 300, 313, 320, 435, 579, 580, 584, 585, 586, 587

## Cause

The upstream `on()` mixin tightened its event type parameter:

```ts
// Before: on(eventName: string, handler) — accepted any string
// After:  on<target extends Element>(eventName: EventType<target>, handler)
//         where EventType<target> = string & keyof EventMap<target>
```

`EventMap<Element>` does not include `'click'` (that's on `HTMLElementEventMap`). The `<Button>` component's rendered `HTMLButtonElement` is inferred as `Element` in the mix system.

## Options

1. **Explicit generic**: `on<HTMLButtonElement>('click', handler)` in each call site
2. **Type cast**: `on('click' as any, handler)` — pragmatic but loses safety
3. **Upstream fix**: The remix package could widen `EventType` — not actionable here
