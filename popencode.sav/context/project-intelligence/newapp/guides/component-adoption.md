<!-- Context: project-intelligence/newapp/guides/component-adoption | Priority: high | Version: 1.0 | Updated: 2026-05-11 -->

# Guide: Adopting `remix/ui/*` Components

**Core Idea**: Replace custom mixin-based styling with pre-built `remix/ui/*` components where available. This removes maintenance burden, ensures consistency across apps, and provides SSR-safe Handle-pattern components.

---

## Adoption History

| Component | Old Pattern | Replacement | Status |
|-----------|-------------|-------------|--------|
| Button | `app/ui/mixins/button.ts` → `[button.base, button.primary]` | `remix/ui/button` → `<Button tone="primary">` | ✅ Done |
| *(future)* | `app/ui/mixins/input.ts` → `[input.base, input.focus]` | `remix/ui/input` | ⏳ Pending |

## Button Migration Details

### What Changed

- **Deleted**: `app/ui/mixins/button.ts` (entire file — namespace mixins for all button variants)
- **Replaced**: All `<button mix={[button.base, button.primary]}>` → `<Button tone="primary">`
- **Affected files**: Layout, auth forms, lists client, showcase pages

### Mapping: Old Mixins → New Component

| Old Mixin Usage | New Component Usage |
|-----------------|-------------------|
| `<button mix={[button.base, button.primary]}>Save</button>` | `<Button tone="primary">Save</Button>` |
| `<button mix={[button.base, button.secondary]}>Cancel</button>` | `<Button tone="secondary">Cancel</Button>` |
| `<button mix={[button.base, button.ghost]}>Skip</button>` | `<Button tone="ghost">Skip</Button>` |
| `<button mix={[button.base, button.danger]}>Delete</button>` | `<Button tone="danger">Delete</Button>` |

### SSR Safety

**SSR-safe (Handle pattern only)**: `Button`, `Glyph` — these use the Handle pattern without client-side mixins. They render once on the server and never need re-evaluation on the client. Proven in `app/ui/layout.tsx`.

**NOT SSR-safe (requires clientEntry bridge)**: `Menu`, `Popover`, `Select`, `Listbox`, `Combobox` — these use `createMixin` internally with `on('click')`, `ref()`, or `popover.surface()` to attach client-side behavior. If you import them directly in a server component (like `layout.tsx`), their source modules won't be shipped to the client and their event handlers will never be registered. See the [pre-built component SSR bridge error](../errors/prebuilt-component-ssr-bridge.md) for details and workarounds.

### Gotchas

1. **`type="submit"` vs `type="button"`** — The `Button` component uses `<button>` internally. In forms, the default `type` is `submit`. For non-submit buttons, pass `type="button"` explicitly.
2. **`mix` prop** — `Button` accepts a `mix` prop for additional styles (e.g., `mix={navButtonStyle}`). This composes with the component's internal styles.
3. **`Button` in `clientEntry`** — The `Button` component can be imported in `clientEntry` files (like `app/assets/lists-client.tsx`) without issues.

## When to Adopt a Component

Adopt a `remix/ui/*` component when:

1. A `remix/ui/*` component exists that matches the styling need
2. The component supports the Handle pattern (SSR-safe, can be used in layout)
3. The component's tone/prop API covers the needed variants

**Don't adopt** when:

- The component's API is restrictive (e.g., missing a variant you need)
- The component is not SSR-safe and the usage is in server-rendered context
- Specialized behavior is needed (e.g., custom animation on click)

## Verification Steps

After adopting a component:

1. Search for any remaining references to the old module (e.g., `button.base`, `mixins/button`)
2. Verify the original module file has been deleted (no orphaned files)
3. Check all usage contexts: layout, auth pages, showcase, clientEntry files
4. Verify SSR rendering works (layout.tsx is the best test)

## 📂 Codebase References

- **Button import source**: `remix/ui/button`
- **Usage sites**: `app/ui/layout.tsx`, `app/ui/showcase-pages.tsx`, `app/assets/lists-client.tsx`, `app/actions/auth-login-controller.tsx`, `app/actions/auth-register-controller.tsx`
- **Deleted file**: `app/ui/mixins/button.ts` (no longer exists)
- **Remaining mixins**: `app/ui/mixins/card.ts`, `app/ui/mixins/input.ts`, `app/ui/mixins/text.ts`

## Related

- [Namespace mixins guide](./namespace-mixins.md) — Mixin pattern documentation (updated for button removal)
- [Button testing error (remix3)](../../development/remix3/ui/errors/button-vdom-testing.md) — Known testing gotchas for button components
- [Design system (remix3)](../../development/remix3/ui/concepts/design-system.md) — Token conventions and component API
- [Pre-built Component SSR Bridge error](../errors/prebuilt-component-ssr-bridge.md) — Why `Menu`/`Popover`/`Select`/`Listbox`/`Combobox` require `clientEntry` bridge
