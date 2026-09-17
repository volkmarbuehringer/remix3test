---
name: remix3-unsafe-html
description: "Use when a Remix 3 update makes raw-HTML props (`innerHTML`, `srcDoc`, `srcdoc`) throw `Invalid ... prop` — the value must come from `unsafeHTML()`."
origin: auto-extracted
---

# Raw HTML Props Require `unsafeHTML()` in Remix 3

**Extracted:** 2026-09-17
**Context:** Bumping the pinned `remix` to installable build `2aca9b4e4` (main `c1e61b8`, PR #11885) broke every page that rendered raw HTML through `remix/ui` — `Framework invariant: Invalid innerHTML prop`.

## Problem

As of PR #11885, `remix/ui` refuses plain strings for the props that make the browser parse HTML. They must be opaque values created by `unsafeHTML()`:

- `innerHTML`
- iframe `srcDoc` / `srcdoc`
- `outerHTML` is rejected outright (it would replace a reconciler-owned element)

Passing the old plain string throws a framework invariant at render time. In an app that renders a theme `<style>` through `createElement`, that is a whole-page failure which surfaces in tests as `302`/`500` responses, not a type error.

`unsafeHTML()` is an authorization boundary only — it does **not** sanitize. Keep escaping/trust decisions at the call site.

## Why `tsc` does not catch it

The JSX types do (`HostProps.innerHTML?: UnsafeHTML`, `AllHTMLProps.srcDoc?: Trackable<UnsafeHTML | undefined>`), but the programmatic `createElement` signature is `createElement(type, props?: ElementProps, ...)`, and `ElementProps = Record<string, any>`. So `createElement('style', { innerHTML: '<css>' })` still compiles and only fails at runtime.

Enforcement sites in the installed source:

- `node_modules/.pnpm/@remix-run+ui@*/node_modules/@remix-run/ui/src/runtime/to-vnode.ts:89-90` — `parseHostProps` calls `normalizeUnsafeHTMLProps`
- `.../src/runtime/unsafe-html.ts:62-74` — the invariants (`Invalid innerHTML prop`, `Invalid srcDoc prop`, `Invalid srcdoc prop`, `Invalid outerHTML prop`)
- `.../src/server/stream.ts:593` — the SSR path applies the same normalization
- `.../src/runtime/core/mix.ts:92-109` — mixins may not return raw-HTML props; `children`/`innerHTML`/`srcDoc`/`srcdoc`/`outerHTML` are stripped with a console error

## Solution

```diff
-import { createElement } from 'remix/ui'
+import { createElement, unsafeHTML } from 'remix/ui'

 createElement('style', {
   nonce: handle.props.nonce,
-  innerHTML: escapeStyleText(cssText),
+  innerHTML: unsafeHTML(escapeStyleText(cssText)),
 })
```

JSX has the same shape: `<div innerHTML={unsafeHTML(html)} />`.

The app applies this in `app/ui/theme/runtime.ts` (the only raw-HTML prop site; the other `innerHTML` hits are DOM `el.innerHTML = …` assignments, which are unaffected).

## When to Use

- `Framework invariant: Invalid innerHTML prop` / `Invalid srcDoc prop` / `Invalid srcdoc prop` after a `preview/main` bump
- Migrating any `innerHTML`/`srcDoc`/`srcdoc` prop (JSX or `createElement`) across the #11885 change
- A mixin returns `innerHTML`/`srcDoc`/`srcdoc` and is now stripped
