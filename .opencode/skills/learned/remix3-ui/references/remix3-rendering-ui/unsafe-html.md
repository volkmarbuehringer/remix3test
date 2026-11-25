# Raw HTML Props Require `unsafeHTML()` in Remix 3

**Source:** `remix3-unsafe-html`

**Extracted:** 2026-09-17
**Context:** Bumping the pinned `remix` to installable build `2aca9b4e4` (main `c1e61b8`, PR #11885) broke every page that rendered raw HTML through `remix/component` — `Framework invariant: Invalid innerHTML prop`.

## Problem

As of PR #11885, `remix/component` refuses plain strings for the props that make the browser parse HTML. They must be opaque values created by `unsafeHTML()`:

- `innerHTML`
- iframe `srcDoc` / `srcdoc`
- `outerHTML` is rejected outright (it would replace a reconciler-owned element)

Passing the old plain string throws a framework invariant at render time. In an app that renders a theme `<style>` through `createElement`, that is a whole-page failure which surfaces in tests as `302`/`500` responses, not a type error.

`unsafeHTML()` is an authorization boundary only — it does **not** sanitize. Keep escaping/trust decisions at the call site.

## Why `tsc` does not catch it

The JSX types do (`HostProps.innerHTML?: UnsafeHTML`, `AllHTMLProps.srcDoc?: Trackable<UnsafeHTML | undefined>`), but the programmatic `createElement` signature is `createElement(type, props?: ElementProps, ...)`, and `ElementProps = Record<string, any>`. So `createElement('style', { innerHTML: '<css>' })` still compiles and only fails at runtime.

**Re-validated:** 2026-11-25 against source `24311e52` (`@remix-run/component` 1.3.0; #12429/#12435 folded `unsafe-html.ts` into `runtime/vnode.ts` and moved the host-prop parser into `runtime/vdom.ts` but did not change the validation). Previously 2026-11-19 against source `9e4da4d3` (#12348 shifted only anchors after `insert()`), and 2026-11-17 against `9cbc5144` (#12294 changed only `mountHostNode` after `parseHostProps`; #12314 had folded `core/mix.ts` into `mixins/mixin.ts`). PR #11988 reworded the invariant messages; the guidance is also authored in vendor guide §"Raw HTML with unsafeHTML" (`node_modules/remix/guides/04-rendering-ui.md`).

Enforcement sites in the installed source:

- `node_modules/.pnpm/@remix-run+component@*/node_modules/@remix-run/component/src/runtime/vdom.ts:975` — `parseHostProps` calls `normalizeUnsafeHTMLProps` (`:976`), and is itself invoked at `:934` and `runtime/portal.ts:33`; #12429/#12435 folded the former `reconcile.ts` host props into `vdom.ts`
- `.../src/runtime/vnode.ts:263-280` — the invariants: `Invalid outerHTML prop: outerHTML is not supported on host elements` (`:267-270`) and one shared message, `Invalid <name> prop: expected a value created with unsafeHTML()` (`:275-278`), for `innerHTML`/`srcDoc`/`srcdoc`. #12435 folded the former `unsafe-html.ts` into `vnode.ts`; pre-#11988 builds emitted the bare `Invalid <prop> prop` and listed `outerHTML` with the others.
- `.../src/server/stream.ts:725` — the SSR path applies the same normalization
- `.../src/runtime/mixins/mixin.ts:813-826` — mixins may not return raw-HTML props; `children`/`innerHTML`/`srcDoc`/`srcdoc`/`outerHTML` are stripped (`withoutMixinContentProps` at `:813`) and logged (`mixins must not return children or raw HTML props` at `:825`)

## Solution

```diff
-import { createElement } from 'remix/component'
+import { createElement, unsafeHTML } from 'remix/component'

 createElement('style', {
   nonce: handle.props.nonce,
-  innerHTML: escapeStyleText(cssText),
+  innerHTML: unsafeHTML(escapeStyleText(cssText)),
 })
```

JSX has the same shape: `<div innerHTML={unsafeHTML(html)} />`.

The app applies this in `app/ui/theme/runtime.ts` (the only raw-HTML prop site; the other `innerHTML` hits are DOM `el.innerHTML = …` assignments, which are unaffected).

## When to Use

- `Framework invariant: Invalid innerHTML prop: expected a value created with unsafeHTML()` / the same for `srcDoc`/`srcdoc` after a `preview/main` bump (pre-#11988 builds truncated the message to `Invalid innerHTML prop`)
- Migrating any `innerHTML`/`srcDoc`/`srcdoc` prop (JSX or `createElement`) across the #11885 change
- A mixin returns `innerHTML`/`srcDoc`/`srcdoc` and is now stripped
