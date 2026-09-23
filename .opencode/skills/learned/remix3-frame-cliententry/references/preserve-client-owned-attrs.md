# Preserving Client-Owned Attributes Across Reloads

## What This Covers

An attribute client code owns on an element the frame runtime reconciles — most commonly
a root theme like `data-theme` on `<html>` — reverts to the server-rendered value on every
frame/document reload. Read this when:

- A client-owned attribute flips back after a frame navigation or `handle.update()`
- The app theme follows `prefers-color-scheme` but jumps to light after any reload
- Adding an attribute to `<html>`/`<body>` (or any reconciled element) that client code mutates post-SSR

## Problem

Frame DOM replacement reconciles the live element against the incoming server HTML
attribute-by-attribute (`diffElementAttributes` in `node_modules/@remix-run/ui/src/runtime/diff-dom.ts`).
Only `open`, `checked`, and `value` on native form elements are exempt
(`shouldPreserveLiveAttribute`). Any other client-set attribute the incoming HTML does not
carry is **removed**; one it carries with a different value is **overwritten**.

In this app the theme is client-owned: the `app/ui/document.tsx` head bootstrap and
`ThemeToggle` set/remove `data-theme` on `document.documentElement`. With no explicit
choice (OS `prefers-color-scheme`) no cookie is written, so the server renders `<html>`
**without** `data-theme` — and the next document/frame reconciliation removes the
client-set attribute, flipping the app back to light until a full page load re-runs the script.

## Solution

Mark the client-owned attribute names on the server-rendered element with
`data-rmx-preserve-attrs` (space-separated). The list is read from the incoming HTML on
each reconcile: listed attributes keep their live value **or absence**; all others reconcile
normally. Works on `<html>` and `<body>`.

```tsx
// app/ui/document.tsx
<html lang="de" data-rmx-preserve-attrs="data-theme" data-theme={isDark ? 'dark' : undefined} ...>
```

Removing a name (or clearing the attribute) on the incoming HTML immediately returns that
attribute to normal reconciliation.

## When to Use

- A theme / `open` / custom attribute is owned by client code on a reconciled element (root theme is canonical).
- Adding any attribute to `<html>`/`<body>` that client code mutates post-SSR.

## Verification

Server test: fetch a full document and assert `<html ... data-rmx-preserve-attrs="data-theme">`
(`app/router.test.ts` "Document shell — client-owned theme attribute").

## Vendor Reference

`node_modules/remix/src/ui/README.md` (`data-rmx-preserve-attrs`) — preview build a4d62e19, #11895/#11809