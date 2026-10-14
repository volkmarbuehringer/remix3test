---
name: remix3-rendering-ui
description: "Use when building Remix 3 pages and components — component context / handle.id / TypedEventTarget, the document shell and asset-entry/ImportMap/head wiring, choosing between app-owned `css()` styling and `@remix-run/ui` headless primitives, raw-HTML props (`unsafeHTML()`), and HTML-string responses outside the component runtime (`remix/html-template`)."
user-invocable: false
origin: learned
---

# Remix 3 Rendering UI

**Consolidated from:** `remix3-unsafe-html`, `remix-html-template`

**Extracted:** 2026-09-26

This skill is the **pointer/delta index** for the rendering-ui guide's uncovered surfaces. The canonical patterns live in the installed guide `node_modules/remix/guides/04-rendering-ui.md`; the component mental model is in the vendor `remix` skill (`.opencode/skills/remix/SKILL.md`, "Components"). Do not restate the guide here — these references name the app seams and the disambiguations the guide cannot know.

## Load Only The References You Need

| Task involves... | Start with |
| --- | --- |
| Sharing a value with descendant components (`handle.context`), generating a stable DOM id (`handle.id`), or a browser-reactive context value (`TypedEventTarget`) | `references/component-context-and-handle-id.md` |
| Adding to `<head>` (meta/og, modulepreload, styles, CSP nonce), wiring the browser entry script / import map, or `context.render(tree, ResponseInit)` | `references/document-shell-and-asset-entry.md` |
| Choosing between app-owned `css()` styling and an `@remix-run/ui` headless primitive, or deciding whether to wrap/replace a vendor component | `references/first-party-ui-blocks.md` |
| Rendering raw HTML through a prop (`innerHTML`, iframe `srcDoc`/`srcdoc`) and `Framework invariant: Invalid … prop` throws after a Remix bump | `references/unsafe-html.md` |
| Returning an HTML string outside the component runtime (standalone 500/429/error pages, frame fragments, email/RSS), with XSS-safe interpolation | `references/html-template.md` |

## Core Rules

**Component context, `handle.id`, `TypedEventTarget` (`references/component-context-and-handle-id.md`)**

- `handle.context` is **component-tree** context (provider type is the key; `handle.context.set(v)` in setup, `handle.context.get(Provider)` in a consumer). It is not the server request context: this app's `remix/middleware/async-context` `getContext()` / middleware `context.set/get` is a separate, request-scoped mechanism used in `app/ui/document.tsx` and `app/middleware/*`. Do not mix them.
- `handle.context.set(...)` stores a value but schedules no render; for context that changes in the browser use a `TypedEventTarget` (guide).
- `handle.id` wires a label/input/ARIA relationship without an `id` prop.
- As of extraction this app uses **none** of the three (zero occurrences); follow the guide and treat it as new surface if you introduce one.

**Document shell and asset entry (`references/document-shell-and-asset-entry.md`)**

- The shell is `app/ui/document.tsx`, not the guide's `app/actions/document.tsx`. Entry data is request-scoped middleware state via `getAssetEntry()` (`app/middleware/asset-entry.ts`), not a `scriptEntry` export from `app/assets.ts`.
- Head: `<ImportMap value={entry.importMap} nonce={getCspNonce()} />` plus modulepreload links; body script uses `entry.href` with a `routes.assets.href({ path: 'app/assets/entry.tsx' })` fallback.
- `loadAssetEntry` **skips frame requests** (`X-Remix-Frame`), so never assume the entry is present in a fragment — compute global head/asset work on document responses.
- `createHtmlResponse()` owns doctype/content-type (it always prepends `<!DOCTYPE html>`); `context.render(tree, { status, headers })` adds status/headers.

**First-party UI blocks (`references/first-party-ui-blocks.md`)**

- Selection order: style the native control with `css()`; reach for an `@remix-run/ui` headless primitive (`accordion`/`anchor`/`animation`/`combobox`/`listbox`/`menu`/`popover`/`select`/`tabs`/`toggle`) when the product needs its behavior or markup. `@remix-run/ui` 0.12.1 no longer exports the styled `button`/`input`/`checkbox`/`radio` mixins or the `breadcrumbs` module (removed in the 0.11 → 0.12 cleanup, #11986), and there are no `/primitives` subpaths; the app vendors its own button (`app/ui/theme/upstream-button.ts`). Interactive controls still need a `clientEntry` boundary. Toggle note (since build `c93cec30`/source `e5ed055`, PR #11986): the upstream `@remix-run/ui/toggle` module exports the mixin as a flat `toggle` callable directly as `mix={toggle({...})}` — the old `toggle.control()` shape no longer exists; the app currently uses no toggle mixin, but do not re-adopt the group-under-`.control` pattern.
- This app wraps the vendored `app/ui/theme/upstream-button.ts` in `app/ui/theme/button.ts` (extra tones, host-type rebind, `buttonLink()` for anchor hosts); the vendored copy must also keep upstream's attribute default (`type="button"`), and a link that needs button styling uses `buttonLink()` — a nested `<a><button>` submits a surrounding form and is blocked by `remix-a11y/no-nested-interactive`.
- It deliberately renders its own breadcrumbs in `app/ui/breadcrumbs.tsx` (the pre-0.12 vendor component hardcoded `light-dark(...)` + `@layer remix-ui.*`, breaking `data-theme` and overrides; it was removed in the 0.11 → 0.12 cleanup).
- Menus use `@remix-run/ui/menu` primitives, wrapped by the app's `app/ui/theme/menu/index.tsx` styled `MenuList`/`MenuItem`; `onMenuSelect` comes from the vendor module.

**Raw HTML props (`references/unsafe-html.md`)**

- As of upstream #11885, `innerHTML`/`srcDoc`/`srcdoc` only accept the opaque value from `unsafeHTML()` (and `outerHTML` is rejected outright); a plain string throws `Framework invariant: Invalid innerHTML prop: expected a value created with unsafeHTML()` at render time, not from `tsc` (`createElement`'s `ElementProps = Record<string, any>`); #11988 added that suffix, and the guide's §"Raw HTML with unsafeHTML" now authors the base pattern. `unsafeHTML()` authorizes, it does not sanitize — keep escaping at the call site. The app's only prop site is `app/ui/theme/runtime.ts` (DOM `el.innerHTML = …` assignments are unaffected).

**HTML-string responses (`references/html-template.md`)**

- Outside the component system, use the `html` tagged template (auto-escaping; `html.raw` for trusted sources) and coerce with `String(html\`…\`)` for a `Response` body; top-level error pages emit a full `<!doctype html>` document, frame errors emit a bare fragment. Never refactor a tagged template to plain interpolation without a manual escape helper — that silently drops XSS escaping.

## When to Use

- You need to pass a value from a component to a descendant without prop-drilling, or to give a reusable control a stable id.
- You are editing the document shell, adding head tags/preloads, or wiring the browser entry/import map.
- You are choosing a `remix/component` building block or deciding whether to use, wrap, or replace a vendor component.
- A link styled as a button submits/reloads its form, or an untyped `button()` control starts submitting after a vendor bump.
- A raw-HTML prop throws `Invalid innerHTML`/`srcDoc`/`srcdoc prop`, or a mixin returning one is now stripped.
- You are writing an HTML-string response (standalone error page, frame fragment, email/RSS) outside the component runtime.

## Related Skills

- vendor `remix` skill (`.opencode/skills/remix/SKILL.md`) — component model (setup/render, `handle.props`, `handle.update`)
- `remix3-css-and-layout` — `css()`, `@layer rmx`, and layout deltas
- `remix3-theme-conformance` — theme tokens and light/dark contrast
- `remix3-client-entries` — the `clientEntry`/hydration boundary and import-map constraints
- `security-gotchas` — CSP nonces for inline scripts
