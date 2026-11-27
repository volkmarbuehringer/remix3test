# JSX Attribute Conventions

**Source:** consolidated from `remix3-svg-attributes`, `remix3-jsx-attribute-rename-blind-spot`

**Validated:** 2026-11-25 against preview release `v0.0.20261125-main-24311e52` / source `24311e52` (`remix` 3.3.0, `component` 1.3.0, `ui` 0.14.0); the SVG normalization below was re-checked empirically against the installed `renderToString()`, and the boolean `aria-*`/`data-*` and `data-rmx-*` reads were re-pinned after #12183 shifted `navigation.ts`.
**Context:** Attributes in `remix/component` JSX — SVG naming, boolean `aria-*`/`data-*` serialization, and runtime-renamed `data-rmx-*` props.

## SVG attributes: prefer kebab-case

App code should write native kebab-case (`stroke-width`, `stop-color`). The runtime also normalizes React-style camelCase SVG props, so `strokeWidth` is **not** silently broken at this pin: `normalizeAttributeName()` kebab-cases props matching the compact `SVG_KEBAB_PROP` regex (`@remix-run/component` `src/runtime/vdom.ts:2432`, normalization at `:2439-2448`; #12433 replaced the former canonical allowlist with this fallback), while canonical camelCase SVG attributes (`viewBox`, `clipPathUnits`, `stdDeviation`) pass through verbatim. Prefer the native spelling anyway — it is the actual attribute, independent of the regex, and reads the same as the emitted markup.

```tsx
// Works, but not the app convention — use the native spelling below.
<svg strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
  <stop stopColor="#6366f1" />
</svg>

// ✅ Native SVG convention
<svg stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <stop stop-color="#6366f1" />
</svg>
```

Verified at `56522c2e` with `renderToString()`: `<svg stroke-width="2" viewBox="0 0 10 10" stop-color="red" xlink:title="Star"><use href="#icon"></use></svg>`.

**`<use>` / xlink:** `xlinkHref` and `xlink:href` normalize to SVG2 `href` (`vdom.ts:2442`), so pass `href` directly in app code. The other camelCase xlink props (`xlinkTitle`, `xlinkShow`, `xlinkRole`, `xlinkArcrole`, `xlinkActuate`, `xlinkType`) become `xlink:*` and are set in the XLink namespace in the browser (`PREFIXED_SVG_PROP` at `:2436`, mapping at `:2443-2445`); for scripts, write `href` rather than hand-rolling the namespaced legacy attribute. The app's glyph (`app/ui/theme/glyph/glyph.tsx`) passes `href` directly, and `app/ui/password-toggle.script.ts` writes only `href`.

Common renames: `strokeWidth`→`stroke-width`, `strokeLinecap`→`stroke-linecap`, `strokeLinejoin`→`stroke-linejoin`, `strokeMiterlimit`→`stroke-miterlimit`, `fillOpacity`→`fill-opacity`, `strokeOpacity`→`stroke-opacity`, `strokeDasharray`→`stroke-dasharray`, `stopColor`→`stop-color`, `stopOpacity`→`stop-opacity`, `clipRule`→`clip-rule`, `fillRule`→`fill-rule`.

## Attribute renames are invisible to typecheck and render tests

`remix/component`'s JSX runtime types props as `ElementProps = Record<string, any>` (`@remix-run/component` `src/runtime/vnode.ts:20` at source `56522c2e`; #12435 moved `core/vnode.ts` up to `runtime/vnode.ts`), so every attribute is accepted on any intrinsic element. Consequences:

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

Current reads (source `56522c2e`): `data-rmx-target` is typed on `FormHTMLProps` (`src/runtime/dom.ts:2309`, also on anchors/buttons at `:1792`), navigation reads `data-rmx-document` at `src/runtime/run.ts:1037`/`:1056` (link/form) and `data-rmx-target`/`-src`/`-reset-scroll`/`-reset-focus`/`-history` at `:1084-1091` (`dist/runtime/run.js:830-836`), and `data-rmx-preserve-dom` is in `src/runtime/diff-dom.ts:55`.

## Boolean `aria-*` / `data-*` values

Since remix #12152, `true`/`false` on `aria-*`,
`data-*`, and the MathML booleanish attributes serialize to `"true"`/`"false"`
on **both** the server and the browser. Before that, SSR emitted an empty
attribute for `true` and omitted `false`, while the browser runtime wrote
strings — hydration changed the DOM, and pre-hydration ARIA state was wrong.
`data-rmx-document`/`data-rmx-preserve-dom` remain presence-based (true =
empty, false = omitted), as does `popover`; plain boolean host props
(`disabled`, `hidden`, …) are still presence-only. `value` is stringified like
`aria-*`/`data-*` — `value={true}` renders `value="true"`, so do not use a
boolean `value` for presence/absence.

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
