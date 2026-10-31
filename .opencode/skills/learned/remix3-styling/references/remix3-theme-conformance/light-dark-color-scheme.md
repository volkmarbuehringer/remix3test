# `light-dark()` Follows `color-scheme`, Not `data-theme`

**Source:** `remix3-styling § Theme Tokens` — app theme toggle + vendor `light-dark()` palettes
**Extracted:** 2026-10-31

**Context:** An app sets `data-theme="dark"` / `"light"` on `<html>` for its own theme tokens, but a vendor component or copied palette uses CSS `light-dark(...)`. The app theme flips; the vendor palette does not.

## Problem

`light-dark()` resolves from the element's **used `color-scheme`**, not from a `data-theme` attribute. Changing `data-theme` alone leaves vendor `light-dark(...)` on the OS scheme:

- OS light + app toggled dark → menus/buttons stay light on a dark page.
- OS dark + explicit light → vendor palettes stay dark.
- The app's breadcrumbs workaround documented this (`app/ui/breadcrumbs.tsx`), and menu/button palettes had the same problem until the shell mapped explicit `data-theme` to `color-scheme` (`app/ui/document.tsx`).

## Solution

Make the explicit theme drive `color-scheme` on the root, and represent explicit light as an attribute instead of removing the attribute:

```css
html[data-theme="dark"] { color-scheme: dark; }
html[data-theme="light"] { color-scheme: light; }
```

- **Server shell:** emit `data-theme="dark"|"light"` for an explicit cookie choice. No attribute means auto/OS, with `<meta name="color-scheme" content="light dark">`.
- **Inline head bootstrap:** set `data-theme` to the explicit value. In auto mode set `dark` when `prefers-color-scheme: dark`, otherwise remove the attribute so the meta follows the OS.
- **Toggle:** set `data-theme="light"` explicitly; do not call `removeAttribute` for light.
- Keep `data-rmx-preserve-attrs="data-theme"` so frame reconciliation retains the choice.

Test the exact head script, not a copy: put the script in a string module (`app/ui/theme-bootstrap.ts`) and execute it in a browser test with `new Function(themeBootstrapScript)()`. Cover explicit dark, explicit light, invalid localStorage → cookie fallback, auto-dark, and auto-light. Assert `data-theme`, not just the string's presence.

```js
// OS light, explicit dark
getComputedStyle(document.documentElement).colorScheme // 'dark'
```

## When to Use

- A theme toggle sets `data-theme` but vendor or `light-dark()` colors stay on the OS scheme.
- Adding an explicit light theme where the old code removed the attribute.
- Auditing a vendor component that hardcodes `light-dark(...)`.
- Writing a browser test for inline head-script theme selection.
