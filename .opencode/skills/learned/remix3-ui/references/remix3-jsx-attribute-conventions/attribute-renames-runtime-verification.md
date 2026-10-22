# Attribute Renames Are Invisible to Typecheck & Render Tests

**Source:** `remix3-jsx-attribute-rename-blind-spot`

**Validated:** 2026-09-24 against `remix` 3.0.0-rc.3, installable build `3e516fcc2` (source `9ed3a5c`) — `ElementProps = Record<string, any>` at `@remix-run/ui` `src/runtime/jsx.ts:17`; `FormHTMLProps` carries `data-rmx-target` (`src/runtime/dom.ts:2305`); the runtime still reads `data-rmx-*` at `dist/runtime/navigation.js:417-437`.

**Re-validated (2026-10-14):** against the now-installed build `2c9e033` (installable dist of source `e6a63ea`; `remix` `3.0.0`, `@remix-run/component` `1.0.0`, `@remix-run/ui` `0.12.1`) — the JSX/attribute runtime now lives in `@remix-run/component`: `ElementProps = Record<string, any>` at `@remix-run/component` `src/runtime/jsx.ts:17`; `FormHTMLProps` carries `data-rmx-target` at `src/runtime/dom.ts:2308`; the runtime reads `data-rmx-target`/`-src`/`-reset-scroll`/`-history` at `dist/runtime/navigation.js:435-465` (`data-rmx-document` in the src at `src/runtime/navigation.ts:587`/`:603` — link/form; the link/src reads are `:592-598`, the form reads `:611-618`; `data-rmx-preserve-dom` at `src/runtime/diff-dom.ts:35`), so the `rmx-*` → `data-rmx-*` rename still holds.

**Re-validated (2026-10-22):** against build `060b32a` (source `56f1fb6`; `remix` `3.0.0`, `@remix-run/component` `1.0.0`, `@remix-run/ui` `0.12.1`) — `ElementProps` is still `Record<string, any>` at `src/runtime/jsx.ts:17`; `FormHTMLProps` carries `data-rmx-target` at `src/runtime/dom.ts:2310` (the new `data-rmx-prefetch` prop is typed at `:1799`); the runtime reads `data-rmx-document` at `src/runtime/navigation.ts:631`/`:647` (link/form), the link reads at `:636-642`, the form reads at `:655-662`, and `dist/runtime/navigation.js:488-516`; `data-rmx-preserve-dom` is still `src/runtime/diff-dom.ts:35`, so the `rmx-*` → `data-rmx-*` rename still holds.

## Problem

`remix/component`'s automatic JSX runtime types the `jsx()` factory's props as `ElementProps = Record<string, any>` (`packages/component/src/runtime/jsx.ts:17` — the installed vendor copy is `@remix-run/component` `src/runtime/jsx.ts`). So **every attribute is accepted** on any intrinsic element — the strict `IntrinsicElements` prop types (e.g. `FormHTMLProps` with `data-rmx-target`) are never enforced on JSX.

Consequences:
- Attribute renames, typos, or removed attributes **compile without error**
- Render-based tests (server-render assertions checking the emitted tree/HTML) **also pass**, because they assert what the component *emits*, not what the runtime *reads*
- The breakage is invisible until you exercise the actual browser runtime

**Real-world example:** The upstream `remix`/`@remix-run/ui` runtime renamed frame-navigation attributes from `rmx-*` to `data-rmx-*` (commit `0839bbf77`, `remix@3.0.0-beta.11`). The app still emitted bare `rmx-*` in 129 places and typecheck + all tests passed — the frame navigation was silently dead.

## Solution

When a runtime contract changes (attribute renamed, prop removed), verify at the **runtime** layer, not via `tsc` or render assertions:

1. **Confirm the installed runtime's actual behavior** — grep the *active* installed package, not the source and not a stale `node_modules/.pnpm` copy (several old `@remix-run/*` builds linger there; resolve the one `remix` actually links):
   ```bash
   UI=$(dirname "$(node -e "console.log(require.resolve('@remix-run/component/package.json',{paths:[require.resolve('remix/package.json')]}))")")
   rg -n "getAttribute\('data-rmx" "$UI/dist/runtime/navigation.js"
   ```
   On build `3e516fcc2` this reads `data-rmx-target`/`-src`/`-reset-scroll`/`-history` at `navigation.js:417-437` (plus `data-rmx-document` and `data-rmx-preserve-dom` from `diff-dom.ts:31`), so the `rmx-*` → `data-rmx-*` rename still holds.
2. **Sweep for stale attributes** with a negative-lookbehind regex (excludes already-renamed `data-rmx-*`):
   ```bash
   rg -n '(?<!data-)rmx-(target|src|document|history|reset-scroll|preserve-dom)' app/ -P
   ```
3. **Add a focused render test** asserting the *new* attribute name is emitted (catches regressions at the render layer).
4. **Exercise the real flow in a browser** (e2e or manual) — the only layer that proves the runtime reads the attribute.
