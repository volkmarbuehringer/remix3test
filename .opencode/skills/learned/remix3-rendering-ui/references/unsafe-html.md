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

**Re-validated:** 2026-10-14 against build `2c9e033` / source `e6a63ea`. PR #11988 reworded the invariant messages and shifted the line refs; the guidance is now also authored in vendor guide §"Raw HTML with unsafeHTML" (`node_modules/remix/guides/04-rendering-ui.md`).

Enforcement sites in the installed source:

- `node_modules/.pnpm/@remix-run+component@*/node_modules/@remix-run/component/src/runtime/to-vnode.ts:89-90` — `parseHostProps` calls `normalizeUnsafeHTMLProps`
- `.../src/runtime/unsafe-html.ts:62-95` — the invariants: `Invalid innerHTML prop: expected a value created with unsafeHTML()` (`:68`), the same wording for `srcDoc` (`:74`) and `srcdoc` (`:80`), and `Invalid outerHTML prop: outerHTML is not supported on host elements` (`:85`). Pre-#11988 builds emitted the bare `Invalid <prop> prop` and listed `outerHTML` with the others.
- `.../src/server/stream.ts:612` — the SSR path applies the same normalization
- `.../src/runtime/core/mix.ts:92-107` — mixins may not return raw-HTML props; `children`/`innerHTML`/`srcDoc`/`srcdoc`/`outerHTML` are stripped (`withoutMixinContentProps`) and logged (`sanitizeReturnedMixinProps`)

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
