<!-- Context: project-intelligence/my_app/errors | Priority: critical | Version: 1.1 | Updated: 2026-05-07 -->

# Error Reference: Frame Rendering Gotchas

**Purpose**: Document issues encountered while implementing Frame-based edit panel in the `/client` route. These patterns apply to any Remix 3 route using `<Frame>` with programmatic navigation from outside the Frame.

## 1. `response.body` (ReadableStream) Breaks Frame SSR

**Symptom**: Frame markers render empty (`<!-- rmx:f:id --><!-- /rmx:f -->`), no content between them.

**Root cause**: `resolveFrame` in `render.tsx` was returning `response.body ?? response.text()`. The `response.body` is a `ReadableStream`. The Frame server streamer cannot consume a ReadableStream for inline template rendering.

**Fix**: Always return `response.text()` (a string) from `resolveFrame`:

```typescript
// ❌ BROKEN
async resolveFrame(src, target) {
  let response = await router.fetch(...)
  return response.body ?? response.text()  // ReadableStream not consumed
}

// ✅ FIXED
async resolveFrame(src, target) {
  let response = await router.fetch(...)
  return response.text()  // always string
}
```

**Reference**: `my_app/app/actions/render.tsx` line 27

## 2. Missing `x-remix-frame` Header

**Symptom**: Frame content renders but server doesn't detect frame requests for conditional rendering.

**Root cause**: The `x-remix-frame: true` header is required for proper Frame SSR. Without it, the server treats Frame requests as regular page loads.

**Fix**: Set `x-remix-frame: true` on both server-side and client-side `resolveFrame`:

```typescript
// Server — my_app/app/actions/render.tsx
async resolveFrame(src, target) {
  let headers = new Headers({ accept: 'text/html' })
  headers.set('x-remix-frame', 'true')  // ← required
  ...
}

// Client — my_app/app/assets/entry.ts
async resolveFrame(src, signal, target) {
  let headers = new Headers({ accept: 'text/html' })
  headers.set('x-remix-frame', 'true')  // ← required
  ...
}
```

This header follows the pattern from the `frame-navigation` demo (`demos/frame-navigation`).

## 3. `navigate()` + `history: 'replace'` Works Only Once

**Symptom**: First call to `navigate(href, { target, history: 'replace' })` updates the Frame. Subsequent calls are ignored.

**Root cause**: The Remix `navigate()` wrapper internally calls `window.navigation.navigate()` with `history: 'replace'`. The Navigation API's `replace` behavior interacts poorly with repeated `event.intercept()` calls — the `navigate` event may not fire on subsequent replaces.

**Fix**: Don't use the Navigation API for programmatic Frame navigation. Instead, use `fetch()` + DOM replacement directly (see §4).

## 4. `<a rmx-target>` Programmatic Clicks Don't Trigger Frame Intercept

**Symptom**: Creating an `<a>` element with `rmx-target="frame-name"` and calling `.click()` navigates the browser URL but doesn't update the Frame.

**Root cause**: Chrome's Navigation API sets `event.sourceElement` only for USER-initiated clicks. Programmatic `.click()` (even with `dispatchEvent`) leaves `sourceElement` null. The `startNavigationListener`'s `getSourceElementNavigationState()` returns `undefined`, so the navigation isn't intercepted.

The `<a rmx-target>` pattern works reliably only for real user clicks — not programmatic navigation.

## 5. `event.destination.getState()` Not Reliable for `$rmx` State

**Symptom**: `window.navigation.navigate(href, { state: { $rmx: true, target: 'frame-name' } })` navigates but the Frame doesn't reload — browser URL changes to the href.

**Root cause**: The `startNavigationListener` falls back to `event.destination.getState()` when no `sourceElement` is present. But `getState()` may not return the state object on all browsers or with all `history` modes.

## 6. `frame.reload()` / `frame.setAttribute('src', url)` Preserves Form Values

**Symptom**: Calling `frame.reload()` after setting `frame.src` to a different record's URL fetches the new content, but form input values and select selections don't update — they stay at the previous record's values.

**Root cause**: The Frame's `render()` → `diffNodes()` algorithm in `diff-dom.js` contains a `shouldPreserveLiveAttribute` function that protects form field values during content updates:

```javascript
// diff-dom.js (runtime internal)
function shouldPreserveLiveAttribute(current, next, name) {
  if (name === 'value') {
    if (current instanceof HTMLInputElement &&
        next instanceof HTMLInputElement &&
        shouldPreserveInputValue(current)) {
      return current.value !== next.value;  // ← TRUE → skip update
    }
  }
  if (name === 'selected') {
    if (current instanceof HTMLOptionElement &&
        next instanceof HTMLOptionElement) {
      return current.selected !== next.selected;  // ← TRUE → skip update
    }
  }
  return false;
}
```

When `shouldPreserveLiveAttribute` returns `true`, `diffElementAttributes` skips the attribute update:
```javascript
if (shouldPreserveLiveAttribute(current, next, name))
  continue;  // setAttribute never called
```

This is designed to avoid clearing user input during live streaming updates. However, it also blocks value changes when loading different records via `reload()`.

**Fix**: Do NOT use `frame.reload()` or `frame.setAttribute('src', url)` for navigating between different records. Instead, use `fetch()` + DOM replacement, which bypasses the value-preserving diff entirely:

```typescript
function loadRecord(rowId: number) {
  let url = `/edit-form/${rowId}`
  fetch(url, { credentials: 'same-origin' })
    .then(r => r.text())
    .then(html => {
      let doc = new DOMParser().parseFromString(html, 'text/html')
      let newForm = doc.getElementById('edit-form')
      let currentForm = document.getElementById('edit-form')
      if (newForm && currentForm && currentForm.parentElement) {
        currentForm.parentElement.innerHTML = newForm.outerHTML
      }
    })
}
```

**Reference**: `my_app/app/assets/grid-client.ts` (`navEditPanel` function), `@remix-run/ui/dist/runtime/diff-dom.js` lines 121-166

**Symptom**: `window.navigation.navigate(href, { state: { $rmx: true, target: 'frame-name' } })` navigates but the Frame doesn't reload — browser URL changes to the href.

**Root cause**: The `startNavigationListener` falls back to `event.destination.getState()` when no `sourceElement` is present. But `getState()` may not return the state object on all browsers or with all `history` modes.

## Recommended Pattern: Hybrid Frame + fetch/DOM

For routes where Frame navigation must be triggered programmatically (not by user link clicks):

1. **Use `<Frame>` for initial SSR only** — the Frame renders the first content via server-side `resolveFrame`
2. **Use `fetch()` + DOM replacement for subsequent navigations** — find the Frame's content element and replace it directly. This is REQUIRED when navigating between different records because `frame.reload()` uses a value-preserving DOM diff that blocks form field updates (see §6).
3. **Keep event delegation on `document`** — since Frames render inline in the same document, events bubble normally

```typescript
function navEditPanel(rowId, offset, sort, order) {
  let url = `/client/edit-fragment/${rowId}?offset=${offset}&sort=${sort}&order=${order}`
  fetch(url, { credentials: 'same-origin' })
    .then(r => r.text())
    .then(html => {
      let doc = new DOMParser().parseFromString(html, 'text/html')
      let newForm = doc.getElementById('edit-form')
      let currentForm = document.getElementById('edit-form')
      if (newForm && currentForm && currentForm.parentElement) {
        currentForm.parentElement.innerHTML = newForm.outerHTML
      }
    })
}
```

## Reference
- Frame demo: `demos/frame-navigation/app/actions/render.tsx`
- My app render: `my_app/app/actions/render.tsx`
- My app grid client: `my_app/app/assets/grid-client.ts`
- My app entry: `my_app/app/assets/entry.ts`
