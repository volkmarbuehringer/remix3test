<!-- Context: development/remix3/errors/frame-reload-value-preservation | Priority: high | Version: 1.0 | Updated: 2026-05-07 -->

# Error: Frame reload() Preserves Form Field Values

**Symptom**: After calling `handle.frame.reload()` (or setting `frame.src` + `reload()`), the new HTML content appears but form `<input>`, `<select>`, and `<textarea>` values show the **previous record's data**. Input values are not updated to match the new content.

## Root Cause: shouldPreserveLiveAttribute in diff-dom.js

The Frame runtime's `reload()` → `render()` → `diffNodes()` pipeline uses an attribute diffing algorithm that **actively protects** form field values from being overwritten:

```javascript
// diff-dom.js lines 121-166
function shouldPreserveLiveAttribute(current, next, name) {
  if (name === 'open') {
    if (current instanceof HTMLDetailsElement && next instanceof HTMLDetailsElement) {
      return current.open !== next.open;
    }
    if (current instanceof HTMLDialogElement && next instanceof HTMLDialogElement) {
      return current.open !== next.open;
    }
  }
  if (name === 'checked') {
    if (current instanceof HTMLInputElement && next instanceof HTMLInputElement) {
      return current.checked !== next.checked;
    }
  }
  if (name === 'value') {
    if (current instanceof HTMLInputElement &&
        next instanceof HTMLInputElement &&
        shouldPreserveInputValue(current)) {
      return current.value !== next.value;  // true → skip setAttribute
    }
  }
  if (name === 'selected') {
    if (current instanceof HTMLOptionElement && next instanceof HTMLOptionElement) {
      return current.selected !== next.selected;
    }
  }
  if (name === 'popover') {
    return isPopoverOpen(current) !== isPopoverOpen(next);
  }
  return false;
}
```

When `shouldPreserveLiveAttribute` returns `true`, `diffElementAttributes` calls `continue` — `setAttribute('value', newValue)` is **never executed**.

## Affected Attributes

| Attribute | Elements | Effect |
|-----------|----------|--------|
| `value` | `<input>` (text, email, hidden, etc.) | Text/email/hidden inputs keep old value |
| `checked` | `<input type="checkbox">` | Checkbox state preserved |
| `selected` | `<option>` | Dropdown selection preserved |
| `open` | `<details>`, `<dialog>` | Open/closed state preserved |
| `popover` | Any popover element | Popover state preserved |
| Child nodes | `<textarea>` | Textarea content preserved via `shouldPreserveElementChildren` |

## Design Intent

This behavior is **intentional** — it prevents clearing user input during live streaming Frame updates where only part of the content changes. The Frame runtime assumes content updates via `reload()` are **incremental refreshes** (e.g., updating a badge count), not **full record replacements** (e.g., navigating from one edit form to another).

## Workaround

For record navigation where you need to completely replace form contents, bypass the Frame and use `fetch()` + `DOMParser` + `innerHTML` directly:

```typescript
// ❌ Frame reload: preserves old form values
handle.frame.reload()

// ✅ Manual fetch: complete DOM replacement
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

This replaces the entire DOM subtree (`innerHTML` assignment destroys old elements) rather than diffing attributes, so all form values are correctly updated.

## Prevention

- **For incremental updates** (badge counts, status indicators): Frame `reload()` works correctly (form fields aren't involved)
- **For form navigation** (loading different record data): Use manual `fetch()` + `DOMParser` + `innerHTML` to completely replace the form subtree
- **For partial form updates**: Use individual `fetch()` calls targeting specific fields or a lightweight client-side data binding approach

## Related

- `guides/manual-fetch-patterns.md` — Manual fetch pattern (workaround technique)
- `errors/frame-reload-crash.md` — Different Frame reload crash (DOMException on embedded frames)
- `errors/frame-programmatic-navigation.md` — Programmatic navigation limitations
- `ui/concepts/frame-reload-paths.md` — Frame reload paths

## Codebase References

**Runtime source (not user-modifiable)**:
- `@remix-run/ui/dist/runtime/diff-dom.js` — `shouldPreserveLiveAttribute()` (line 121), `shouldPreserveInputValue()` (line 158), `diffElementAttributes()` (line 98)

**Workaround implementation example**:
- `my_app/app/assets/grid-client.ts` — `navEditPanel()` function using fetch + DOMParser + innerHTML
