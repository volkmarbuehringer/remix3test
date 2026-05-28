<!-- Context: frame-navigation/errors/frame-hydration-loop | Priority: high | Version: 1.0 | Updated: 2026-03-25 -->

# Frame Hydration Loop Error

## Error

```
Error: handle.update() infinite loop detected
    flush scheduler.ts:107
    dequeue scheduler.ts:251
    render vdom.ts:146
    hydrateRegion frame.ts:695
```

## Cause

Using `handle.update()` in `clientEntry` components with Frame navigation causes hydration loops.

### Problematic Pattern

```tsx
// ❌ This causes infinite loops
export let EditableField = clientEntry(
  '/assets/edit.js#EditableField',
  function EditableField(handle) {
    return (props) => {
      // handle.update() called during render/hydration
      return (
        <span
          onclick={() => {
            handle.update()
          }}
        >
          {props.value}
        </span>
      )
    }
  },
)
```

## Solution: Event Delegation

### 1. Pure Render Components

```tsx
// ✅ No handle.update() - just data attributes
export function SimpleEditable() {
  return (props) => (
    <span
      class="editable-simple"
      data-field={props.fieldName}
      data-url={props.updateUrl}
      data-value={props.value}
    >
      {props.value}
    </span>
  )
}
```

### 2. Event Delegation Client

```tsx
// ✅ No state changes during render
export let EditableDelegation = clientEntry(
  '/assets/delegate.js#Delegation',
  function Delegation() {
    document.addEventListener('click', (e) => {
      let target = e.target.closest('.editable-simple')
      if (target) showInlineEditor(target)
    })
    return () => null
  },
)
```

### 3. Optimistic UI

```tsx
// On success - update DOM directly, no reload
if (res.ok) {
  editable.classList.add('just-saved')
  editable.textContent = newValue
  showToast('Updated')
}
```

## Why This Works

1. **No state changes during render** - Components are pure, static
2. **No handle.update()** - Client script modifies DOM directly
3. **Event delegation** - Single listener handles all edits
4. **Optimistic updates** - Immediate feedback, no reload

## Files

| File                                 | Purpose                           |
| ------------------------------------ | --------------------------------- |
| `app/assets/simple-editable.tsx`     | Pure render components            |
| `app/assets/editable-delegation.tsx` | Event delegation + optimistic UI  |
| `app/admin/layout.tsx`               | Includes `<EditableDelegation />` |

## CSS Classes

```css
.editable-simple           /* Base clickable element */
.editable-form             /* Inline edit form container */
.editable-simple.is-saving /* Saving state (opacity, pointer-events) */
.editable-simple.just-saved /* Success flash (green background) */
```
