# Remix 3 No-JS Fallbacks That Survive Client Patching

**Extracted:** 2026-09-19
**Updated:** 2026-11-02 (removed the retired settings-panel recipe; this is now a generic fallback)
**Context:** A Remix 3 page server-hides inactive content (e.g. tab panels with the
`hidden` attribute) to avoid a first-paint flash and needs a CSS rule that
re-reveals it when scripting is disabled.

## Problem

Progressive-enhancement CSS that must apply **only when JS is off** cannot use the
two obvious mechanisms, because the client runtime mutates the DOM after hydration:

1. **`<noscript><style>` goes live.** After the first client-side patch (tab click,
   frame navigation) the runtime re-parses the noscript body into real elements.
   Observed in Chromium on the extraction build: the noscript `childElementCount` goes
   `0 → 1` and the reveal rule applies with scripting **enabled**, forcing every
   server-hidden panel back to `display:flex` (first click works, later clicks show everything).
2. **A JS-set `<html>` flag is wiped.** An inline head script that sets e.g.
   `document.documentElement.setAttribute('data-js','true')` works on first load,
   but the runtime reconciles the document element against the fresh server HTML on
   navigation and drops the attribute, so the override stops matching.

## Solution

Scope the reveal rule to the CSS `scripting` media feature — evaluated by the
browser against the real scripting setting, immune to DOM patching:

```tsx
const NOJS_REVEAL_CSS =
  '@media (scripting: none) { [data-tabpanel][hidden] { display: flex !important; } }'
// rendered once in the page:
<style>{NOJS_REVEAL_CSS}</style>
```

Keep the server-side hide (`hidden={inactive || undefined}`) so there is no
first-paint flash; `!important` beats the panel descriptor's author-origin
`&[hidden]{display:none}`.

> **Current app state (2026-11-02):** `app/` has no `@media (scripting: none)` reveal,
> no `PANEL_REVEAL_CSS`, and no server-hidden tab panels — the settings tabs are
> server-rendered. Treat the snippet above as a generic recipe, not an app seam, and
> re-verify the noscript re-parse behaviour on the pinned build before relying on it.

## Verification

- JS enabled: click each tab and assert `getComputedStyle(panel).display === 'none'`
  for every non-active panel — this catches the noscript regression.
- Playwright `browser.newContext({ javaScriptEnabled: false })`: assert every panel
  computes `display:flex`.

## When to Use

- A server-rendered element is hidden to prevent FOUC and must reappear without JS.
- You are about to write `<noscript>` or a `<html data-*>` flag for a CSS fallback
  on a page that hydrates client entries.
