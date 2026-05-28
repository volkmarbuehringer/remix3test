<!-- Context: development/remix3/concepts/theme-switching | Priority: high | Version: 1.0 | Updated: 2026-04-28 -->

# Concept: SSR Theme Switching (Three-Layer Architecture)

**Core Idea**: Theme switching in Remix 3 uses three coordinated layers — SSR-rendered `data-theme` from a cookie, a flash-prevention inline script in `<head>`, and document-level event delegation — because the component model replaces DOM nodes on navigation (orphaning old listeners).

---

## Key Points

- **Layer 1 (SSR)**: `data-theme` on `<html>` read from a `theme` cookie on every SSR request. Syncs cookie → SSR markup.
- **Layer 2 (Flash-prevention)**: IIFE in `<head>` reads `localStorage.getItem('theme')` and sets `data-theme` before first paint. Catches first-time or cookie-less visitors.
- **Layer 3 (Event delegation)**: Single `document.addEventListener('click', handler)` using `e.target.closest('#theme-toggle')`. Survives DOM replacements from `clientEntry` navigations.
- **Dual storage**: Both `localStorage` (for flash-prevention script) and `document.cookie` (for SSR) are written on every toggle.
- `getElementById().addEventListener()` breaks on `clientEntry` because the toggle button's DOM node is replaced and the old listener is orphaned.

---

## Implementation

```tsx
// Layer 1: SSR data-theme from cookie
<html lang="en" data-theme={themeCookie === 'dark' ? 'dark' : undefined}>

// Layer 2: Flash prevention in <head>
<script>{`
  (function() {
    try {
      var t = localStorage.getItem('theme')
      if (t === 'dark') document.documentElement.setAttribute('data-theme', 'dark')
    } catch(e) {}
  })()
`}</script>

// Layer 3: Event delegation on document
<script>{`
  document.addEventListener('click', function(e) {
    var btn = e.target.closest('#theme-toggle')
    if (!btn) return
    var html = document.documentElement
    var isDark = html.getAttribute('data-theme') === 'dark'
    if (isDark) {
      html.removeAttribute('data-theme')
      localStorage.setItem('theme', 'light')
      document.cookie = 'theme=light; path=/; max-age=31536000; SameSite=Lax'
    } else {
      html.setAttribute('data-theme', 'dark')
      localStorage.setItem('theme', 'dark')
      document.cookie = 'theme=dark; path=/; max-age=31536000; SameSite=Lax'
    }
  })
`}</script>
```

---

## Why getElementById Fails

```
Layout renders → button#theme-toggle exists → listener attached
User navigates → clientEntry replaces layout → new button DOM node
                                        → OLD listener references DESTROYED node
                                        → clicks stop working
```

**Event delegation on `document` avoids this** — `closest()` traverses from the event target upward regardless of DOM replacements.

---

## 📂 Codebase References

**Implementation**:
- `bookstore/app/ui/document.tsx` — All three layers (SSR data-theme, flash-prevention, event delegation)
- `bookstore/app/ui/layout.tsx` — Contains only the `<button id="theme-toggle">` trigger

**Related**:
- `concepts/theme-contract.md` — createTheme() CSS custom property contract
- `guides/design-system.md` — Design system overview with flash prevention mention
