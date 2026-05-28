<!-- Context: development/remix3/ui/guides/nav-link | Priority: high | Version: 1.0 | Updated: 2026-05-13 -->

# NavLink — Frame-Aware Navigation Component

**Purpose**: Shared Handle component that renders an `<a>` element with frame navigation attributes (`rmx-target`, `rmx-document`, `target="_top"`) and active-state detection, for use across all frame-navigated layouts.

## Quick Reference

- **Pattern**: Handle component wrapping `<a>`, NOT a regular component function
- **Use in**: Layout sidebar navigation (AI, Admin)
- **Do NOT use in**: Unit-tested pages where VDOM traversal is needed (e.g., client grid)

## Usage

```tsx
// Frame-targeted link (updates frame content)
<NavLink route={routes.admin.index} target={frames.adminContent} active={activeItem === 'dashboard'}>
  Dashboard
</NavLink>

// Document-level link (full page navigation)
<NavLink href="/lists" document active={false}>
  Lists
</NavLink>

// Plain link (no frame behavior)
<NavLink href="/about" active={false}>
  About
</NavLink>
```

## Props

| Prop | Type | Effect |
|------|------|--------|
| `href` | `string` | Direct URL |
| `route` | `{ href: () => string }` | Route object with `.href()` method |
| `target` | `string` | Sets `rmx-target` attribute (frame target) |
| `active` | `boolean` | Sets `aria-current="page"` when true |
| `document` | `boolean` | Sets `rmx-document` + `target="_top"` (full page nav) |
| `mix` | any | CSS mixin(s) |
| `style` | `Record<string, string>` | Inline styles |
| `children` | `RemixNode` | Link content |

At least one of `href` or `route` must be provided. If both are absent, renders `href="#"`.

## Implementation Pattern

```tsx
// app/ui/nav-link.tsx
export function NavLink(handle: Handle<NavLinkProps>) {
  return () => {
    let { href, route, target: frameTarget, active, document: isDocument, mix, style, children } = handle.props
    let resolvedHref = href ?? route?.href() ?? '#'

    let extra: Record<string, string | undefined> = {}
    if (frameTarget) extra['rmx-target'] = frameTarget
    if (isDocument) {
      extra['rmx-document'] = ''
      extra['target'] = '_top'
    }

    return (
      <a href={resolvedHref} aria-current={active ? 'page' : undefined}
          mix={mix} style={style} {...extra}>
        {children}
      </a>
    )
  }
}
```

## Layout Integration

**Admin layout** (`app/ui/admin-layout.tsx`): Frame-targeted links use `target={frames.adminContent}` (for `iframeNav: true` items). Full-page links use `document` prop (for `iframeNav: false` items like `/lists`, `/client`).

**AI layout** (`app/ui/ai-layout.tsx`): All sidebar links use `target={frames.aiContent}` since all AI sub-pages are rendered inside the AI frame.

## Why Handle Component?

NavLink uses the Handle component signature `(handle: Handle<Props>) => () => VNode`, NOT a regular function. This gives it access to `handle.props` for render-time prop resolution. This is the standard Remix pattern for components that need render-phase prop access in frames.

## Constraint

The Handle component pattern produces VDOM elements where `el.type` is the `NavLink` function reference, not a host element string. This means test helpers like `treeContainsText` **cannot traverse** NavLink's children. For pages that rely on VDOM tree traversal in unit tests (e.g., client grid pagination), use plain `<a>` tags with inline `rmx-target` instead.

## Codebase References

- `newapp/app/ui/nav-link.tsx` — Implementation
- `newapp/app/ui/admin-layout.tsx` — Admin sidebar usage
- `newapp/app/ui/ai-layout.tsx` — AI sidebar usage
- `newapp/app/actions/client/grid-page.tsx` — Plain anchor fallback (no NavLink)

## Related

- `ui/errors/handle-component-vdom-testing.md` — VDOM testing limitations
- `ui/guides/handle-api.md` — Handle API reference
- `ui/concepts/component-model.md` — Component model (Handle vs regular components)
