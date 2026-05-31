<!-- Context: development/remix3/ui/errors/handle-component-vdom-testing | Priority: medium | Version: 1.0 | Updated: 2026-05-13 -->

# Error: Handle Component VDOM Testing Limitations

**Issue**: Handle components (using the `(handle: Handle<Props>) => () => VNode` signature) render as VDOM nodes with `type` set to the function reference, not a host element string. Test helpers like `treeContainsText` that traverse the VDOM tree **cannot penetrate** Handle components to find their children.

## What Goes Wrong

```tsx
// NavLink is a Handle component
<NavLink route={routes.admin.dashboard} target="admin-content" active={false}>
  Dashboard
</NavLink>

// treeContainsText cannot find "Dashboard" inside NavLink
treeContainsText(rendered, 'Dashboard') // → false ❌
```

In VDOM, `NavLink` renders as:
```
{ type: NavLink, props: { route: ..., children: "Dashboard" } }
```

The `type` is the function reference `NavLink`, not a string like `'a'`. The `treeContainsText` helper does not invoke component functions, so it can't see the rendered children.

## Why

Remix 3's VDOM represents Handle component elements with `type` set to the component function reference. Only primitive host elements (`<div>`, `<span>`, `<a>`, etc.) have string `type` values. Handle components are NOT host elements — they're factory functions that return render functions, so they're invisible to VDOM tree traversal.

This is similar to the Button VDOM issue but distinct: Button from `remix/ui/button` is a regular custom component that wraps `<button>`, while a Handle component like NavLink is a completely different pattern (factory → render function).

## Fix

Use plain host elements in unit-tested VDOM trees instead of Handle components:

```tsx
// ❌ Won't work with treeContainsText
<NavLink route={someRoute} target="my-frame" active={isActive}>
  Click me
</NavLink>

// ✅ Works — host element <a> has string type 'a'
<a
  href={someRoute.href()}
  rmx-target="my-frame"
  aria-current={isActive ? 'page' : undefined}
>
  Click me
</a>
```

## Affected Components

- Any Handle component wrapping a host element (e.g., `NavLink`)
- Any component using `(handle: Handle<Props>) => () => VNode` signature

## Testing Alternatives

If you must test content rendered through Handle components:

1. **Integration tests at the DOM level**: Test the rendered DOM output (e.g., via browser tests), not VDOM.
2. **Props-based lookups**: Use `.find()` on the VDOM tree matching `el.props` rather than content.
3. **data-testid attributes**: Add `data-testid` to the host element inside the Handle component and search by that.

```tsx
// In the test, find by data-testid instead of content
let link = rendered.find(el => el.props?.['data-testid'] === 'nav-dashboard')
```

## Related

- `ui/errors/button-vdom-testing.md` — Button VDOM testing (similar but distinct issue)
- `ui/guides/nav-link.md` — NavLink component pattern
- `ui/concepts/component-model.md` — Component model (Handle vs regular components)
