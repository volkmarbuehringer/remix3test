# JSX Attribute Conventions

**Source:** consolidated from `remix3-svg-attributes`, `remix3-jsx-attribute-rename-blind-spot`

**Validated:** 2026-11-05 against preview release `v0.20261105.172537-main-ca504176` / source `ca504176` (`remix` 3.2.0, `component` 1.2.0, `ui` 0.13.1); the boolean `aria-*`/`data-*` and `data-rmx-*` reads below were re-pinned in the same pass.
**Context:** Attributes in `remix/component` JSX — SVG naming, boolean `aria-*`/`data-*` serialization, and runtime-renamed `data-rmx-*` props.

## SVG attributes use kebab-case

React/Preact camelCase names (`strokeWidth`, `strokeLinecap`, `stopColor`) do not render: Remix 3's JSX runtime passes attributes through verbatim, and the SVG parser only recognizes lowercase kebab-case.

```tsx
// ❌ React convention — silently broken
<svg strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
  <stop stopColor="#6366f1" />
</svg>

// ✅ Native SVG convention
<svg stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <stop stop-color="#6366f1" />
</svg>
```

Common renames: `strokeWidth`→`stroke-width`, `strokeLinecap`→`stroke-linecap`, `strokeLinejoin`→`stroke-linejoin`, `strokeMiterlimit`→`stroke-miterlimit`, `fillOpacity`→`fill-opacity`, `strokeOpacity`→`stroke-opacity`, `strokeDasharray`→`stroke-dasharray`, `stopColor`→`stop-color`, `stopOpacity`→`stop-opacity`, `clipRule`→`clip-rule`, `fillRule`→`fill-rule`.

## Attribute renames are invisible to typecheck and render tests

`remix/component`'s JSX runtime types props as `ElementProps = Record<string, any>` (`@remix-run/component` `src/runtime/core/vnode.ts:17`; #12159 folded `jsx.ts` into `core/vnode.ts`), so every attribute is accepted on any intrinsic element. Consequences:

- Typos, removed attributes, and renames compile cleanly.
- Server-render assertions pass because they check what the component **emits**, not what the runtime **reads**.
- Breakage surfaces only when the real browser runtime runs.

Real case: the runtime renamed frame-navigation attributes from `rmx-*` to `data-rmx-*` (commit `0839bbf77`, beta.11). The app still emitted bare `rmx-*` in 129 places; typecheck and all tests passed while frame navigation was silently dead.

When a runtime contract changes, verify at the runtime layer:

1. **Grep the active installed package**, not the source or a stale `.pnpm` copy — resolve the one `remix` links:
   ```bash
   UI=$(dirname "$(node -e "console.log(require.resolve('@remix-run/component/package.json',{paths:[require.resolve('remix/package.json')]}))")")
   rg -n "getAttribute\('data-rmx" "$UI/dist/runtime/navigation.js"
   ```
2. **Sweep for stale attributes** with a negative lookbehind so `data-rmx-*` is excluded:
   ```bash
   rg -n '(?<!data-)rmx-(target|src|document|history|reset-scroll|preserve-dom)' app/ -P
   ```
3. **Add a focused render test** asserting the new attribute name is emitted.
4. **Exercise the real flow in a browser** — the only layer that proves the runtime reads it.

Current reads (preview release `ca504176`): `data-rmx-target` is typed on `FormHTMLProps` (`src/runtime/dom.ts:2309`), navigation reads `data-rmx-document` at `src/runtime/navigation.ts:775`/`:782` (link/form) and `data-rmx-target`/`-src`/`-reset-scroll`/`-reset-focus`/`-history` at `:801-808` (`dist/runtime/navigation.js:629-635`), and `data-rmx-preserve-dom` is in `src/runtime/diff-dom.ts:38`.

## Boolean `aria-*` / `data-*` values

Since remix #12152, `true`/`false` on `aria-*`,
`data-*`, and the MathML booleanish attributes serialize to `"true"`/`"false"`
on **both** the server and the browser. Before that, SSR emitted an empty
attribute for `true` and omitted `false`, while the browser runtime wrote
strings — hydration changed the DOM, and pre-hydration ARIA state was wrong.
`data-rmx-document`/`data-rmx-preserve-dom` remain presence-based (true =
empty, false = omitted), as do `popover` and `value`; plain boolean host props
(`disabled`, `hidden`, …) are still presence-only.

Consequences:

- A bare JSX marker (`data-foo`) now renders `data-foo="true"`. Tests that
  assert `getAttribute('data-foo') === ''` must switch to `hasAttribute`.
- Boolean ARIA is safe: `aria-expanded={menuOpen}` renders `"true"`/`"false"`
  in SSR and survives hydration. Prefer it over a string ternary.
- Presence selectors (`[data-foo]`) keep working; value selectors can use
  `[aria-expanded="true"]`.

App seams: `app/actions/lists/public/lists-view.tsx` passes boolean
`aria-pressed`/`aria-expanded`; `app/actions/lists/lists-sidebar-menu.test.e2e.ts`
asserts focus through the bare `data-list-menu-button` marker, now via
`hasAttribute`.
