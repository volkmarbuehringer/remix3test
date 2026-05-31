<!-- Context: development/remix3/errors/frame-programmatic-navigation | Priority: high | Version: 1.0 | Updated: 2026-05-05 -->

# Error: Programmatic Frame Navigation Limitations

**Symptom**: Calling `navigate(href, { target })` or programmatically clicking `<a rmx-target>` does not update a named Frame — the browser URL changes but the Frame content stays stale.

## Root Cause: Chrome Navigation API + Remix Interception

Remix 3's `startNavigationListener` intercepts Frame navigations via two paths:

1. **Source element** (`getSourceElementNavigationState`): Works when a user physically clicks an `<a>` element with `rmx-target`. Chrome sets `event.sourceElement` to the clicked element. **Does NOT work for programmatic `.click()` or `dispatchEvent()`**.

2. **Destination state** (`event.destination.getState()`): Falls back to checking the navigation state for `{ $rmx: true, target }`. Works in theory but is unreliable in practice — Chrome may not return the state object for `history: 'replace'` navigations.

## Attempted Approaches (All Have Issues)

| Approach | Result |
|----------|--------|
| `navigate(href, { target, src, history: 'replace' })` | Only fires once; subsequent calls ignored |
| `navigate(href, { target, src })` (no history) | Defaults to `auto`; URL changes on `push` |
| `<a rmx-target>` + `.click()` | Chrome doesn't set `sourceElement` for programmatic clicks |
| `<a rmx-target>` + `dispatchEvent(new MouseEvent('click'))` | Same — `sourceElement` is null for untrusted events |
| `window.navigation.navigate(href, { state: { $rmx: true, target }, history: 'replace' })` | URL changes but Frame doesn't reload — `event.destination.getState()` may not return state |

## Recommended Workaround

For routes that need programmatic Frame navigation (triggered by JS event handlers, not user link clicks):

```typescript
function navEditPanel(rowId, offset, sort, order) {
  let url = `/client/edit-fragment/${rowId}?offset=${offset}&sort=${sort}&order=${order}`
  fetch(url, { credentials: 'same-origin' })
    .then(r => r.text())
    .then(html => {
      let doc = new DOMParser().parseFromString(html, 'text/html')
      let newContent = doc.getElementById('edit-form')
      let currentContent = document.getElementById('edit-form')
      if (newContent && currentContent?.parentElement) {
        currentContent.parentElement.innerHTML = newContent.outerHTML
      }
    })
}
```

This pattern:
- ✅ Works reliably for any number of successive navigations
- ✅ No URL changes (no Navigation API interaction)
- ✅ Events still bubble since Frames render inline in the same document
- ⚠️ Bypasses Frame runtime state management — only use when Frame content is a simple SSR fragment

## When Navigation API Works

The Navigation API + `<a rmx-target>` pattern works reliably for:
- User clicking real `<a>` elements in the page
- Form submissions inside Frames
- Navigation triggered by the Frame runtime itself

It does NOT work for:
- Programmatic `click()` on dynamically created `<a>` elements
- JS event handlers calling `navigate()` from outside a Frame
- Repeated rapid Frame updates from client code

## Related
- `ui/guides/frame-resolution.md` — Frame SSR patterns with critical gotchas
- `project-intelligence/my_app/errors/frame-rendering-gotchas.md` — my_app-specific Frame errors
- `demos/frame-navigation/app/actions/settings/controller.tsx` — Demo showing `<a rmx-target>` for user-initiated Frame navigation

## Codebase References
- Remix listener: `@remix-run/ui/dist/runtime/navigation.js` — `startNavigationListenerImpl`
- Remix Frame: `@remix-run/ui/dist/runtime/frame.js` — `createFrame`, `reload`
