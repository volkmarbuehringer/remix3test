---
name: remix-mobile-nav-hamburger
description: "Responsive Remix 3 mobile nav with hamburger toggle, full-screen overlay, focus management, scroll lock, and aria support"
user-invocable: false
origin: auto-extracted
---

# Remix 3 Mobile Nav Hamburger Pattern

**Extracted:** 2026-06-09
**Context:** Building a responsive navbar that replaces desktop horizontal links with a hamburger-triggered full-screen overlay on mobile

## Problem

A desktop horizontal nav bar with 6-8 items overflows on mobile screens. You need a hamburger menu that:
- Replaces the desktop nav links on mobile with a curated set of action-oriented items
- Uses a full-screen overlay (not a slide drawer or dropdown)
- Manages focus correctly (keyboard trap prevention)
- Locks body scroll when open
- Has proper `aria-expanded`, `role="dialog"`, `aria-modal` for accessibility
- Closes on: ✕ button, backdrop tap, nav link click, Escape key
- Works within Remix 3's `clientEntry` hydration model (clientEntry must live in `app/assets/`, not `app/ui/`)

## Solution

### 1. Nav Data Layer (`app/ui/nav.ts`)

Define mobile-specific items alongside desktop `NAV_SECTIONS`:

```typescript
export type MobileNavItem = {
  label: string
  href: string
  requireAuth: boolean
  cta?: boolean  // true = styled as primary CTA button
}

export const MOBILE_ITEMS: MobileNavItem[] = [
  { label: 'Neuer Termin', href: '/appointments/new', requireAuth: true, cta: true },
  { label: 'Einstellungen', href: '/settings', requireAuth: true },
]
```

### 2. Client Entry for Toggle (`app/assets/nav-toggle.tsx`)

```typescript
import { clientEntry, type Handle } from 'remix/ui'

export const NavToggle = clientEntry(
  import.meta.url + '#NavToggle',
  function NavToggleEntry(handle: Handle) {
    let initialized = false
    let previousFocus: HTMLElement | null = null

    return () => {
      if (!initialized && typeof document !== 'undefined') {
        initialized = true

        let drawer = document.getElementById('nav-drawer')
        let btn = document.getElementById('nav-toggle')
        if (!drawer || !btn) return

        btn.addEventListener('click', () => toggle())

        // Escape key: scoped to drawer, not document (avoids cross-page leaks)
        drawer.addEventListener('keydown', (e) => {
          if (e.key === 'Escape') close()
        })

        // Close on any tap inside the drawer (backdrop, links, close button)
        drawer.addEventListener('click', () => close())

        function toggle() {
          let isOpen = drawer!.classList.toggle('is-open')
          btn!.setAttribute('aria-expanded', String(isOpen))
          document.body.style.overflow = isOpen ? 'hidden' : ''
          if (isOpen) {
            previousFocus = document.activeElement as HTMLElement
            let closeBtn = document.getElementById('nav-close')
            if (closeBtn) closeBtn.focus()
          } else if (previousFocus) {
            previousFocus.focus()
            previousFocus = null
          }
        }

        function close() {
          if (drawer!.classList.contains('is-open')) toggle()
        }
      }
      return null
    }
  },
)
```

Key design decisions:
- **Close on any drawer click**: simplifies the handler — no need to check `el.closest('a')` etc., because navigation already handles link clicks; tapping padding/gaps should also close
- **Escape listener on the drawer element**, not `document` — prevents cross-page listener leaks
- **Focus management**: store `document.activeElement` before opening, restore it on close
- **Body scroll lock**: `document.body.style.overflow = 'hidden'` / `''`
- **`aria-expanded` sync**: kept in the client entry alongside the class toggle

### 3. CSS Strategy (`app/ui/main-nav.tsx`)

Use paired media query constants for the responsive switch:

```typescript
// Hides desktop nav on mobile
const desktopOnlyCss = css({
  '@media (max-width: 768px)': {
    display: 'none',
  },
})

// Shows hamburger on mobile only
const mobileOnlyCss = css({
  display: 'none',
  '@media (max-width: 768px)': {
    display: 'flex',
  },
})

// Full-screen overlay (hidden by default, shown via .is-open)
const navDrawerCss = css({
  display: 'none',
  position: 'fixed',
  inset: 0,
  zIndex: 200,
  flexDirection: 'column',
  background: theme.surface.lvl0,
  '&.is-open': { display: 'flex' },
  // Force-hide on desktop in case drawer is left open after resize
  '@media (min-width: 769px)': {
    display: 'none !important',
  },
})
```

⚠️ **Breakpoint pairing**: Use `max-width: 768px` for mobile rules and `min-width: 769px` for desktop rules. These are contiguous — no gap at exactly 768px. Document the pairing with comments so they stay in sync.

### 4. Template Structure (`app/ui/main-nav.tsx`)

```
<header>
  <div nav-inner>
    <a logo/>

    <nav desktop-links mix={[navLinksCss, desktopOnlyCss]}>
      NAV_SECTIONS items, settings, login/logout
    </nav>

    <div hamburger-wrapper mix={[headerActionsCss, mobileOnlyCss]}>
      <button id="nav-toggle" aria-expanded="false" aria-controls="nav-drawer" />
    </div>

    <button id="theme-toggle" />  ← always visible on both desktop/mobile
  </div>

  <NavToggle />  ← non-visual, registers event listeners

  <div id="nav-drawer" role="dialog" aria-modal="true" aria-label="Navigation" mix={navDrawerCss}>
    <div drawer-header>
      <a logo />
      <button id="nav-close" />
    </div>
    <div drawer-body>
      {user ? <CTA /> + settings link + logout form : <login link />}
    </div>
  </div>
</header>
```

### 5. Auth-Gated Content

Read auth state via `getCurrentUserSafely()` and CSRF token via `getCsrfToken(getContext())`:

```typescript
let user = getCurrentUserSafely()
let csrfToken: string | undefined
try {
  csrfToken = getCsrfToken(getContext())
} catch { /* CSRF may not be active */ }
```

Render mobile items based on auth state:
- **Logged in**: show items where `requireAuth: true`, plus logout form with CSRF
- **Logged out**: show only login link

Style the primary CTA as an indigo button matching the desktop login button pattern:
```typescript
const drawerCtaCss = css({
  display: 'inline-flex',
  alignItems: 'center',
  color: 'white',
  textDecoration: 'none',
  fontSize: '1.125rem',
  fontWeight: 600,
  padding: '0.75rem 2rem',
  borderRadius: theme.radius.md,
  background: indigo[600],
  '&:hover': { background: indigo[700] },
})
```

## When to Use

Use this pattern when:

- Adding a responsive hamburger menu to a Remix 3 app that currently has a horizontal desktop nav bar
- You need a full-screen overlay (not a slide drawer or dropdown) for mobile navigation
- You want proper accessibility (focus management, aria attributes) with the `clientEntry` hydration model
- The mobile nav needs different/curated items than the desktop nav (auth-gated CTAs vs full nav tree)
- You're working in a Remix 3 codebase that uses `remix/ui`'s `css()` and `clientEntry` patterns

Do NOT use when:
- You need a slide-in drawer or bottom tab bar (this pattern is specifically a full-screen overlay)
- The app isn't using Remix 3's `remix/ui` component model
- You need animation/transition on the overlay (this pattern uses instant pop)
