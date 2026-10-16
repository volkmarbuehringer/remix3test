# Component-owned DOM conversion: hidden-div + scan → rendered entry with `ref`

**Source:** session 2026-10-16 (message-compose / password-complexity / theme-toggle conversions)

**Context:** Three enhancer clientEntries (`app/ui/message-compose.browser.tsx`,
`password-complexity-script.browser.tsx`, `theme-toggle.browser.tsx`) rendered a
hidden div (or `null`), scanned server DOM via `queueTask`/inline `<script>`, and
registered document-level listeners behind module-scoped `listenersRegistered`
guards. All three now render the interactive element itself and bind listeners
in its `ref((el, signal) => …)` / `on(...)`, so cleanup follows the element's
signal on frame swap. Commit `b7b878f`. Verified against remix build `7f900151`.

## Mechanics that made the conversion safe

- **Hydration anchors are comment markers, not elements.** The server wraps an
  entry component's output in `<!-- rmx:h:id --> … <!-- /rmx:h -->` (see
  `@remix-run/component/src/server/stream.ts`, `buildEntrySegment`), so a
  clientEntry may render a **fragment root** — no wrapper div needed around
  multi-element output.
- **`ref` and `on` are `{ ssr: false }` mixins** (`ref-mixin.ts`, `on-mixin.ts`):
  the ref callback never runs during SSR, so sessionStorage/localStorage access
  inside it is browser-only. Server markup and client markup must match
  (pass server state like `defaultValue` as serializable props).
- **Server markup cannot carry mixins through entry props.** `createHydrationPropsReplacer`
  serializes children as `{$rmx: true, type, props}` without mixin objects — so
  you cannot keep a server-rendered input and attach a `ref` to it from a
  wrapping entry. The entry must *render* the element it enhances. (This is why
  the old code scanned: the enhancer didn't own the node.)
- **Styles move with the markup.** Page-local `css()` objects used only by the
  converted block move into the browser module (imports of shared mixins like
  `ui/mixins/input.ts` are fine — the module is already in the server graph
  because the page imports the entry from it).

## The `on()` host-binding gotcha

`on(type, handler, capture?)` binds **only to the mixin's host node**
(`on-mixin.ts` `insert` handler: `currentNode.addEventListener(...)`). A
container that is a *sibling* of the watched input (e.g. a checklist div next to
`input[name=password]` inside the same `<label>`) never sees the input's bubbled
events — 8/12 tests failed before this was understood. When the enhanced element
is not the entry's host (or not its descendant), bind a scoped native listener in
the `ref` with `{ signal }`:

```tsx
ref((node, signal) => {
  let form = (node as HTMLElement).closest('form')
  form?.addEventListener('input', (e) => {
    if ((e.target as HTMLInputElement)?.name !== handle.props.fieldName) return
    /* … */
  }, { signal })
})
```

Scoped-to-form beats the old document-level listener: same behavior, narrower
surface, and the signal cleans it up. A `<textarea>`'s own `el.form` property is
the cheapest form handle.

## Test conversions

- `render(<Entry/>, { container })` mounts into an existing element, but
  `cleanup()` **removes the container itself** — render into an inner div inside
  the fixture when a later case re-renders into the same fixture.
- `ref` callbacks fire during the initial `root.flush()` inside `render()`, so
  bind-time effects (draft restore, first `updateMeta`) are already applied when
  `render` returns; `await result.act(() => undefined)` is only belt-and-braces.
- Server tests that asserted the old mechanism need rewrites, not tweaks: the
  inline-script nonce assertion became "criteria text must NOT be in the
  document; hydration mount + `fieldName` prop must be".

## When to Use

Converting any enhancer that renders `null`/hidden-div + scan + module-scoped
document listeners. The four mechanical steps: render the element from the
entry with serializable props → move used-only-here styles → bind listeners in
`ref` with the signal (form-scoped when the enhanced element is a sibling) →
delete the module guard and rewrite the fixture to render the entry into a
real form context.

## Related

- `stream-controller-extraction.md` — the reconciliation rule this follows
  (mechanical moves verbatim; semantics preserved: draft clears on
  submit *and* submit-click, server value wins at bind time)
- `client-entry-decomposition.md` — never slice by line offset
- `remix3-testing` — delegated listeners outlive tests; scope queries to container
