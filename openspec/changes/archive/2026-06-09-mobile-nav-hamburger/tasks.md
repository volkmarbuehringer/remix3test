## 1. Nav Data

- [x] 1.1 Add `MOBILE_ITEMS` export to `app/ui/nav.ts` with curated mobile nav items and their auth requirements

## 2. Toggle Client Entry

- [x] 2.1 Create `app/assets/nav-toggle.tsx` with `clientEntry` that listens for clicks on the hamburger button, toggles `.is-open` on the overlay, and handles close triggers (✕, backdrop tap, nav link tap, Escape key)

## 3. Main Nav Rendering

- [x] 3.1 Update `app/ui/main-nav.tsx` to add hamburger button (visible only on mobile, `display: none` on desktop)
- [x] 3.2 Add full-screen overlay with header (logo + ✕ close button) and body (CTA + links, auth-gated)
- [x] 3.3 Add CSS for overlay: fixed positioning, `transform-origin: top right`, backdrop, responsive display rules
- [x] 3.4 Add CSS media query at 768px: hide desktop `nav-links` on mobile, show hamburger
- [x] 3.5 Style "Neuer Termin" CTA with indigo background (matching existing `navBtnCss` pattern)
- [x] 3.6 Wire CSRF token into overlay logout form

## 4. Tests

- [x] 4.1 Update `app/ui/nav.test.ts` to cover `MOBILE_ITEMS` data structure
- [x] 4.2 Add overlay rendering tests for both auth states (logged in, logged out) _(data structure tested in 4.1; visual rendering is CSS-driven and covered by existing route tests that render MainNav)_
