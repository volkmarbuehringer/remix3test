<!-- Context: development/remix3/ui/errors/button-vdom-testing | Priority: medium | Version: 1.0 | Updated: 2026-05-05 -->

# Error: Button VDOM Testing Pattern

**Issue**: In VDOM test trees, `Button` from `remix/ui/button` renders as a node with `type: Button` (the function reference), NOT `type: 'button'` (the string host element). This causes test predicate failures.

## What Goes Wrong

```tsx
// ❌ Does NOT work in VDOM test trees
if (el.type === 'button') { ... }           // type is Button function, not 'button'
if (el.tagName === 'BUTTON') { ... }        // no tagName on VDOM nodes
if (el.localName === 'button') { ... }      // no localName on VDOM nodes
```

## Why

Remix 3's VDOM represents elements with `type` set to the component function reference for custom components, not string host element names. Only primitive host elements (`<div>`, `<span>`, etc.) have string `type` values. The `Button` component wraps a `<button>` host element internally, but the VDOM node at the test level is the `Button` component, not the underlying host element.

## Solution

Use `data-*` attributes or props for test predicates:

```tsx
// ✅ Use data attributes in the component
function MyButton(handle: Handle, setup: { label: string }) {
  return () => (
    <button data-testid="submit-btn">{setup.label}</button>
  )
}

// ✅ Test by data attribute
let btn = rendered.find(el => el.props?.['data-testid'] === 'submit-btn')
```

Or search by props:

```tsx
// ✅ Test by props
let btn = rendered.find(el => el.props?.type === 'submit')
let btn = rendered.find(el => el.props?.class === 'my-button-class')
```

## Alternative: Host Element Selectors

For VDOM trees that ARE host elements (e.g., a `<button>` directly in JSX), string-based type checks work:
```tsx
<span mix={[on('click', handler)]}>Click me</span>
// type === 'span' ✅ — this is a host element
```

But `Button` from `remix/ui/button` is always a custom component, never a host element.

**Related**:
- `errors/handle-component-vdom-testing.md` — Handle component VDOM testing (NavLink and similar)
- `../concepts/component-model.md` — Component model reference
- `../../test/guides/testing-patterns.md` — Testing patterns
