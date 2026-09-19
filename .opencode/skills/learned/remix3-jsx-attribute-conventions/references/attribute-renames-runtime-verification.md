# Attribute Renames Are Invisible to Typecheck & Render Tests

**Source:** `remix3-jsx-attribute-rename-blind-spot`

## Problem

`remix/ui`'s automatic JSX runtime types the `jsx()` factory's props as `ElementProps = Record<string, any>` (`packages/ui/src/runtime/jsx.d.ts`). So **every attribute is accepted** on any intrinsic element — the strict `IntrinsicElements` prop types (e.g. `FormHTMLProps` with `data-rmx-target`) are never enforced on JSX.

Consequences:
- Attribute renames, typos, or removed attributes **compile without error**
- Render-based tests (server-render assertions checking the emitted tree/HTML) **also pass**, because they assert what the component *emits*, not what the runtime *reads*
- The breakage is invisible until you exercise the actual browser runtime

**Real-world example:** The upstream `remix`/`@remix-run/ui` runtime renamed frame-navigation attributes from `rmx-*` to `data-rmx-*` (commit `0839bbf77`, `remix@3.0.0-beta.11`). The app still emitted bare `rmx-*` in 129 places and typecheck + all tests passed — the frame navigation was silently dead.

## Solution

When a runtime contract changes (attribute renamed, prop removed), verify at the **runtime** layer, not via `tsc` or render assertions:

1. **Confirm the installed runtime's actual behavior** — grep the installed package, not the source:
   ```bash
   rg -n "getAttribute\('data-rmx" node_modules/@remix-run/ui/dist/runtime/navigation.js
   ```
2. **Sweep for stale attributes** with a negative-lookbehind regex (excludes already-renamed `data-rmx-*`):
   ```bash
   rg -n '(?<!data-)rmx-(target|src|document|history|reset-scroll|preserve-dom)' app/ -P
   ```
3. **Add a focused render test** asserting the *new* attribute name is emitted (catches regressions at the render layer).
4. **Exercise the real flow in a browser** (e2e or manual) — the only layer that proves the runtime reads the attribute.
