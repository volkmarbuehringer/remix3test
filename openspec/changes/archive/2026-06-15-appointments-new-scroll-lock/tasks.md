## 1. Appointments Page Scroll Lock

- [x] 1.1 Create `app/assets/appointments-scroll-lock.tsx` — clientEntry that reads URL params (`editing`, `deleting`, `creating`) on mount, calls `lockScroll()` if panel is open, listens for `popstate` to re-evaluate, and unlocks on unmount
- [x] 1.2 Add the clientEntry to `app/ui/appointments-new-page.tsx` — render the `<AppointmentsScrollLock>` entry in the panel branch of the template
- [x] 1.3 Verify: navigate to `/appointments/new?editing=1` — page scroll is locked, scrollbar-gutter is stable, scroll position saved

## 2. Nav Drawer: Replace Manual Scroll Lock

- [x] 2.1 Import `lockScroll` from `remix/ui/scroll-lock` in `app/assets/nav-toggle.tsx`
- [x] 2.2 Replace `document.body.style.overflow = 'hidden'` / `''` with `lockScroll()` — store unlock function in closure, call on open/close
- [x] 2.3 Verify: open mobile nav drawer — scroll is locked with proper gutter compensation, scroll position restored on close

## 3. Tests

- [x] 3.1 Add test for appointments-page-scroll-lock clientEntry — verify lockScroll is called when panel URL params are present, unlock on popstate
- [x] 3.2 Add test for nav-toggle — verify lockScroll/unlockScroll are called on toggle
