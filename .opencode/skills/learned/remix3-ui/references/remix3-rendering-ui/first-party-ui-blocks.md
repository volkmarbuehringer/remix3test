# Remix 3 First-Party UI Blocks (app styling → headless primitives)

**Source:** installed guide `node_modules/remix/guides/04-rendering-ui.md` — §"Optional headless UI primitives", with the styling sections §"Styling with css and dynamic style values" and §"Cascade layers and app-owned design tokens".

**Extracted:** 2026-09-26

**Context:** Choosing a `remix/component/*` building block, or deciding whether to use, wrap, or replace a vendor component.

## Problem

No skill names `app/ui/theme/upstream-button.ts`, `@remix-run/ui/accordion`, or `@remix-run/ui/select`, so the primitives/ownership model is guide-only. A generic "use the vendor component" answer also misses this app's deliberate wrappers and replacement.

## Solution

Use the guide's selection model, then this app's concrete decisions.

**Selection order (installed `@remix-run/ui` 0.12.1):**

1. **Native elements styled with `css()`** — keep the real `<button>`/`<input>`/checkbox/radio and style it with `remix/component` style descriptors (guide §"Styling with css and dynamic style values"). The former `@remix-run/ui` styled `button`/`input`/`checkbox`/`radio` mixins and the `breadcrumbs` module were deleted in the 0.11 → 0.12 cleanup (#11986), so there is no vendor style mixin to import; the app vendors its own button (`app/ui/theme/upstream-button.ts`).
2. **Headless primitives** — `@remix-run/ui` 0.12.1 ships `accordion`, `anchor`, `animation`, `combobox`, `listbox`, `menu`, `popover`, `select`, `tabs`, and `toggle` (ui README "Primitives" and "Animation"). They own structural attributes, keyboard/focus behavior, and disclosure/selection state. Use `default*` for uncontrolled and the controlled prop/callback when the parent owns state (names differ by component). Use them only when the product needs their behavior or different markup, not just different colors; the app then owns labels, ARIA, and pointer/keyboard behavior. Select/combobox still need a hidden input to participate in a form. There are no `/primitives` subpaths in this build.

Interactive controls must sit inside a `clientEntry(...)` boundary, directly or via an interactive ancestor (see `remix3-client-entries`).

**App-specific deltas:**

- **Button is wrapped, not used raw.** `app/ui/theme/button.ts` imports `app/ui/theme/upstream-button.ts`, adds `secondary`/`danger`/`dangerOutline` tones, and rebinds the mixin host type to `HTMLButtonElement` (a type-level workaround for TypeScript's order-sensitive recursive assignability). `buttonLink()` rebinds to `HTMLAnchorElement` so a navigation link is styled as a button without nesting a `<button>` inside an `<a>`.
- **The vendored button must keep upstream's *attribute* mixin, not just its CSS.** The #11948 split copied only the three CSS descriptors into `app/ui/theme/upstream-button.ts` and dropped `buttonDefaultAttrs`, which defaults a native `<button>` host with no explicit `type` to `type="button"`. Without it, every untyped `<button mix={[button()]}>` — including click-only actions — renders as an implicit `type="submit"`. `tsc` and render-tree tests cannot see this; assert the rendered `type` in a browser test (`app/ui/theme/button.test.browser.tsx`). Restore it by re-adding a `createMixin` that returns `createElement(handle.element, { ...props, type: 'button' })` when `hostType === 'button'` and `props.type === undefined`.
- **Never nest a `<button>` in an `<a>` — it only *looks* fine outside a form.** In Chromium and Firefox alike, `<a><button>` navigates when there is no form owner, but inside a `<form>` the inner button's default submit wins and the link silently submits the form. That is how the `/verwaltung/appointments` Zeitraum/Status chips broke (they reloaded `?filter=`, dropping `period`/`status`) once the vendoring removed the implicit `type="button"`. Style the `<a>` with `buttonLink()` and enforce the content model with the repo-local oxlint rule `remix-a11y/no-nested-interactive` (`scripts/oxlint-plugins/no-nested-interactive-plugin.ts`, registered in `.oxlintrc.json`).
- **Breadcrumbs are deliberately app-owned.** `app/ui/breadcrumbs.tsx` does **not** use a vendor breadcrumbs component: the pre-0.12 vendor component (since deleted in the 0.11 → 0.12 cleanup) wrapped classes in `@layer remix-ui.<class>`, which made overrides unreliable. The app re-renders with theme tokens — see `remix3-theme-conformance` and `remix3-css-and-layout`. The document shell now maps an explicit `data-theme` to `color-scheme`, so vendor `light-dark(...)` palettes follow the app theme.
- **Menus use primitives, styled by an app wrapper.** Context menus import `MenuList`/`MenuItem` from `app/ui/theme/menu/index.tsx` and `onMenuSelect` from `@remix-run/ui/menu`, inside browser clientEntries.

## When to Use

- Adding a styled button/input or an `@remix-run/ui` primitive (select/accordion/menu/tabs) to a page and choosing between app-owned styling and a primitive.
- Deciding whether to use a vendor `remix/component` component, wrap it (as with button), or replace it (as with breadcrumbs).
- A link styled as a button silently submits/reloads the surrounding form, or an untyped `button()` control starts submitting a form after a vendor bump.
- Moving from an app-owned control to a primitive when custom markup or behavior is needed.

## Reference

- `node_modules/remix/guides/04-rendering-ui.md` §"Styling with css and dynamic style values", §"Cascade layers and app-owned design tokens", §"Optional headless UI primitives"
- `node_modules/.pnpm/@remix-run+ui@*/node_modules/@remix-run/ui/README.md` — per-subpath primitives API (the aliased `remix/src/ui` path no longer exists)
- `app/ui/theme/button.ts`, `app/ui/breadcrumbs.tsx`
