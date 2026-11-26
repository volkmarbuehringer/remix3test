# Shell overlay portal + imperative bridge host

**Extracted:** 2026-11-24
**Context:** Browser-only transient layers in a Remix 3 app whose pages scroll inside `app/ui/layout.tsx`'s `[data-page-scroller]` and swap through frames. Use when an imperative helper must reach a component-owned host and the UI must escape clipping, stacking, or a containing block.

## Problem

- A `position: fixed` overlay is trapped when an ancestor has `transform`, `filter`, or `backdrop-filter`. The sticky header's `backdrop-filter` was the nav-drawer regression (`app/actions/home/home-nav-responsive.test.e2e.ts`).
- The app's real scroll container is `app/ui/layout.tsx`'s `[data-page-scroller]` (`overflowY: auto`); content inside it is clipped and scrolls with the page.
- Frame swaps replace their own DOM; an overlay hosted inside a frame disappears on navigation.
- Independent client entries (grid + types panel) need one stack and one owner; appending a per-feature root to `document.body` duplicates roots and ordering.
- Imperative callers (`showToast`, `requestConfirm`) are plain modules, not components, so they cannot render a host.

## Solution

### 1. One destination in the shell

`app/ui/document.tsx` renders the destination after the shell, outside every frame and before the entry script:

```tsx
{children}
<div id={APP_OVERLAY_ROOT_ID} />
```

After the shell keeps overlay content last in DOM/tab order and outside the named `app-header` / `app-sidebar` / `admin-lists-content` view-transition regions. Do not hide the element; it stays empty until a portal uses it.

### 2. SSR-safe portal wrapper

`app/ui/overlay-root.tsx` owns the id and the wrapper:

```tsx
export const APP_OVERLAY_ROOT_ID = 'app-overlay-root'

export function getAppOverlayRoot(): HTMLElement | null {
  if (typeof document === 'undefined') return null
  return document.getElementById(APP_OVERLAY_ROOT_ID)
}

export function OverlayPortal(handle: Handle<{ children?: RemixNode }>) {
  return () => {
    let container = getAppOverlayRoot()
    let children = handle.props.children
    return container
      ? <Portal container={container}>{children}</Portal>
      : <Portal>{children}</Portal> // body fallback for isolated/test docs
  }
}
```

`Portal` is client-entry-only. It renders nothing during SSR, stays absent without a client-entry ancestor, requires a same-document `HTMLElement`, and changing `container` remounts the children. The fallback to `document.body` is `Portal`'s default and keeps tests and documents without the shell working.

### 3. Imperative caller → document CustomEvent

Keep the public helper tiny and SSR-safe:

```ts
export const TOAST_EVENT = 'app:toast-request'

export function showToast(message: string, tone: ToastTone = 'error') {
  if (typeof document === 'undefined') return
  document.dispatchEvent(
    new CustomEvent<ToastRequest>(TOAST_EVENT, { detail: { message, tone } }),
  )
}
```

`requestConfirm` / `requestConfirmDecision` in `app/ui/confirm-delete.browser.tsx` are the precedent (`app:confirm-request`; cancelable event, `defaultPrevented` tells the caller whether a host took over). For awaiting variants return `null` when no host is mounted so headless paths can fall back.

### 4. One shell host owns state and lifetime

Mount one `clientEntry` in `Document` next to `FlashAnnouncer` (`app/ui/toast-host.browser.tsx`), not per page or per frame. Subscribe in a `ref` on a hidden marker and set the ready attribute only after the listener is attached:

```tsx
<div
  data-toast-host=""
  mix={[
    css({ display: 'none' }),
    ref((element, signal) => {
      document.addEventListener(TOAST_EVENT, onToast, { signal })
      element.setAttribute('data-toast-host-ready', 'true')
    }),
  ]}
/>
```

The ref signal removes the listener on host disposal; `handle.signal` clears timers and `requestAnimationFrame` handles. `handle.queueTask` + `handle.signal` remains the default for ordinary document listeners; the hidden-marker ref variant is for a host that also needs a hydration-ready marker (same pattern as `app/actions/lists/public/lists-row-actions.tsx`).

Render the portal only when there is content:

```tsx
{toasts.length > 0 ? (
  <OverlayPortal>
    <div id="__toast-root">…</div>
  </OverlayPortal>
) : null}
```

That keeps `#app-overlay-root` empty on load and removes the viewport with the last item.

### 5. Tests

- **Browser:** mount the host with `render()`, create `#app-overlay-root` **before** rendering, call the imperative API inside `act`, and assert the destination/parent, tone/role split, and fake-timer removal. Add a fallback test with no root (content lands in `body`).
- **Fake timers:** install before `showToast`; wrap `timers.advance()` in `act` so component updates flush before DOM assertions.
- **Theme tones:** browser-test documents do not run the shell's `Theme`; set `--rmx-*` variables on `document.documentElement` before asserting computed colours (same as `app/actions/lists/public/lists-editor-layout.test.browser.tsx`).
- **E2E:** hidden ready markers are not “visible”; wait with `state: 'attached'`, then dispatch the bridge event and assert the viewport's parent is `#app-overlay-root`.
- **E2E (frame survival):** `app/ui/toast-frame-survival.test.e2e.ts` seeds the appointment weeks, waits for `[data-toast-host-ready]` with `state: 'attached'`, dispatches the bridge event, then clicks the next-week frame link. It counts `page.on('load')` and sets a `window` probe, proving the toast in `#app-overlay-root` survives a same-document frame swap rather than a document reload. Keep the click/date assertion inside the 3500 ms display window; do not extend production timings for the test.
- **Server mocks:** if a module imported by a server test can call the imperative API, a fake `document` must implement `dispatchEvent()`. A mock built for an older imperative DOM (`getElementById` / `createElement` / `body.appendChild`) throws `document.dispatchEvent is not a function`; `{ dispatchEvent: () => true }` models “no host mounted”. Same failure mode as the `requestConfirm` stub in `remix3 § Data` → `references/remix-forms/delete-confirmation.md`.

## Use / avoid

Use for browser-only transient layers that must escape clipping/stacking, survive frame swaps, or share one stack across independent client entries.

Do **not** use for:

- Modal or focus-contained UI — native `<dialog>` + `showModal()` owns the top layer, inertness, Escape, focus containment, and focus restore. `@remix-run/ui/dialog` has its own portal and focus stack; the shell-mounted `ConfirmDelete` uses that instead of `OverlayPortal`.
- Menus/popovers — `@remix-run/ui/menu` owns its own `menu.Portal` and focus boundaries; use `MenuList`, not `OverlayPortal`.
- SSR-visible / no-JS content, streamed frame HTML, or form controls that must submit with a form (form ownership follows the destination DOM).

`Portal` changes placement only; it adds no z-index, inertness, focus management, or event isolation.

## Gotchas

- Destination DOM decides event bubbling, form ownership, tab order, and inherited styles. Document-level delegation still works; an ancestor-scoped `closest()`/`querySelector()` from the source tree does not see portal content.
- A `position: fixed` child inside a transformed/`backdrop-filter` ancestor is positioned against that ancestor. The shell/body has neither, which is why the overlay root works.
- Resolve the container on each render; creating the root after the host renders leaves the host on the body fallback.
- Frame HTML patches exclude portal marker ranges (`excludePortalRanges`), so a frame update does not clobber them; a frame navigation that unmounts the client entry still disposes the portal.
- No host mounted → the event is dropped. Document that the imperative helper is a no-op in SSR/isolated tests.
- Do not append a new per-feature root to `document.body`; extend this one.

## App seams

- `app/ui/overlay-root.tsx` — id, root resolver, `OverlayPortal`
- `app/ui/document.tsx` — destination + `ToastHost` mount
- `app/ui/toast.ts` / `app/ui/toast-host.browser.tsx` — event bridge + shell host
- `app/ui/confirm-delete.browser.tsx` — shell-mounted `ConfirmDelete` using `@remix-run/ui/dialog` + `requestConfirm` CustomEvent (not `OverlayPortal`)
- `app/ui/overlay-root.test.browser.tsx`, `app/ui/overlay-root.test.e2e.ts`
- `app/ui/toast.test.browser.tsx`, `app/ui/toast-host.test.e2e.ts`, `app/ui/toast-frame-survival.test.e2e.ts`
- `app/ui/appointment-grid-lib.test.ts` — partial document mock updated to `dispatchEvent`

## Related

- `remix3 § Data` → `references/remix-forms/delete-confirmation.md` — the same event bridge and fake-document gotcha for `requestConfirm`
- `remix3 § UI` → `references/remix3-client-entries/native-dialog-drawer.md` — top-layer alternative
- `remix3 § UI` → `references/remix3-client-entries/persistent-live-region.md` — shell-owned persistent live region
- `remix3 § UI` → `references/remix3-rendering-ui/first-party-ui-blocks.md` — why the app keeps its own toast renderer
