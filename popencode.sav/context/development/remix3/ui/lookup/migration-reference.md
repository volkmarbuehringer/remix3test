<!-- Context: development/remix3/ui/lookup | Priority: low | Version: 1.0 | Updated: 2026-05-13 -->

# Migration Reference

Breaking changes from `@remix-run/ui` v0.3.0 → v0.7.0.

## Core API Migration

| Version | Change | Before | After |
|---------|--------|--------|-------|
| v0.3.0 | Component `this` → `handle` param | `function Counter(this: Handle, props)` | `function Counter(handle: Handle, setup?)` |
| v0.3.0 | `setup` prop introduced | Props in setup scope | Only `setup` in setup, props in render |
| v0.5.0 | `handle.update()` returns Promise | `handle.update()` | `let signal = await handle.update()` |
| v0.5.0 | `root.remove()` → `root.dispose()` | `root.remove()` | `root.dispose()` |
| v0.6.0 | Host `on` prop → `on()` mixin | `<button on={{ click(){} }}>` | `<button mix={[on('click', ()=>{})]}>` |
| v0.6.0 | Host `css` prop → `css()` mixin | `<div css={{ color:'red' }}>` | `<div mix={[css({ color:'red' })]}>` |
| v0.6.0 | Host `animate` prop → animation mixins | `<div animate={{ enter:true }}>` | `<div mix={[animateEntrance()]}>` |
| v0.6.0 | Host `connect` prop → `ref()` mixin | `<div connect={(n,s)=>{}}>` | `<div mix={[ref((n,s)=>{})]}>` |
| v0.6.0 | `handle.on()` → `addEventListeners()` | `handle.on(target, listeners)` | `addEventListeners(target, signal, listeners)` |
| v0.6.0 | `@remix-run/interaction` → `remix/ui` | `defineInteraction(...)` | `createMixin(...)` |
| v0.7.0 | Mixin render no longer controls subtree | Mixin could set children/innerHTML | Only patches host props + nested `mix` |
| v0.7.0 | `renderToStream` — `resolveClientEntry` callback | Opaque entry IDs | `resolveClientEntry(entryId, component)` |
| v0.7.0 | Frame navigation interception | No link interception | `link()` mixin, `navigate()`, `rmx-target` attr |

## Key Breaking Boundaries

- **v0.5.0**: SSR + frames introduced; `handle.update()` becomes async
- **v0.6.0**: Legacy host props removed; all mixing via `on()`, `css()`, `ref()`; interaction package merged
- **v0.7.0**: Mixin model finalized; `attrs()` mixin added; nested `mix` arrays; controlled select fix

## Quick Migration (v0.6.0 style → v0.7.0)

```tsx
// Old: individual host props
<button on={{ click: fn }} css={{ color: 'red' }} />

// New: mix array
<button mix={[on('click', fn), css({ color: 'red' })]} />

// Old: interaction package
import { on } from '@remix-run/interaction'

// New: all from remix/ui
import { on, addEventListeners, createMixin } from 'remix/ui'
```

## Reference

`/home/lucky/remix/packages/ui/docs/component-changelog.md`
