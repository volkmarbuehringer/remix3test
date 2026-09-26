# Remix 3 First-Party UI Blocks (mixins → composed → primitives)

**Source:** installed guide `node_modules/remix/guides/04-rendering-ui.md` — "First-party UI building blocks" (L356–460), with the styling sections (L275–354).

**Extracted:** 2026-09-26

**Context:** Choosing a `remix/ui/*` building block, or deciding whether to use, wrap, or replace a vendor component.

## Problem

No skill names `remix/ui/button`, `remix/ui/accordion`, `remix/ui/select`, or the `/primitives` subpaths, so the three-level ownership model is guide-only. A generic "use the vendor component" answer also misses this app's deliberate wrappers and replacement.

## Solution

Use the guide's selection model, then this app's concrete decisions.

**Selection order (guide L356–460):**

1. **Style mixins** — `button`, `input`, `checkbox`, `radio`, `toggle`. Keep the native element; the mixin supplies visuals only. The control stays in `FormData` and keeps browser keyboard behavior.
2. **Composed controls** — `accordion`, `breadcrumbs`, `combobox`, `menu`, `select`, `tabs`. These own the relationships among several elements and their disclosure/selection state. Use `default*` for uncontrolled and the controlled prop/callback when the parent owns state (names differ by component).
3. **Headless primitives** — `popover`, `listbox`, `anchor`, and each available `/primitives` subpath. Use only when the product needs different markup, not just different colors; the app then owns labels, ARIA, and pointer/keyboard behavior. Select/combobox still need a hidden input to participate in a form.

Interactive controls must sit inside a `clientEntry(...)` boundary, directly or via an interactive ancestor (see `remix3-client-entries`).

**App-specific deltas:**

- **Button is wrapped, not used raw.** `app/ui/theme/button.ts` imports `remix/ui/button`, adds `secondary`/`danger`/`dangerOutline` tones, and rebinds the mixin host type to `HTMLButtonElement` (a type-level workaround for TypeScript's order-sensitive recursive assignability). `buttonLink()` rebinds to `HTMLAnchorElement` so a navigation link is styled as a button without nesting a `<button>` inside an `<a>`.
- **Breadcrumbs are deliberately app-owned.** `app/ui/breadcrumbs.tsx` does **not** use `remix/ui/breadcrumbs`: the vendor component hardcodes `light-dark(...)` values that follow the OS `prefers-color-scheme` rather than the app's `data-theme` toggle, and wraps classes in `@layer remix-ui.<class>` which makes overrides unreliable. The app re-renders with theme tokens — see `remix3-theme-conformance` and `remix3-css-and-layout`.
- **Menus use primitives.** Context menus import `remix/ui/menu` and `remix/ui/menu/primitives` (`MenuList`, `MenuItem`, `onMenuSelect`) from browser clientEntries.

## When to Use

- Adding a button/input/select/accordion/menu/tabs to a page and choosing the right level.
- Deciding whether to use a vendor `remix/ui` component, wrap it (as with button), or replace it (as with breadcrumbs).
- Moving from a composed control down to primitives for custom markup.

## Reference

- `node_modules/remix/guides/04-rendering-ui.md` L275–354, L356–460
- `node_modules/remix/src/ui/README.md` — per-subpath API
- `app/ui/theme/button.ts`, `app/ui/breadcrumbs.tsx`
