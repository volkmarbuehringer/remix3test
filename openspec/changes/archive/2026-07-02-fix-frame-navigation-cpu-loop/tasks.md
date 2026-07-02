## 1. Fix admin lists description links

- [x] 1.1 Add `rmx-document` attribute to the description `<a>` tag in `app/ui/admin-lists-page.tsx` on line 321, matching the `target="_top" rmx-document` pattern used by `grid-page.tsx` and `nav-link.tsx`

## 2. Fix MainNav cross-section navigation

- [x] 2.1 In `app/ui/main-nav.tsx`, add logic to conditionally include `rmx-document` on the "Admin" (and "Listen") links when the current page path belongs to a different section than the link target (e.g., when on `/lists` and clicking "Admin", or on `/admin` and clicking "Listen")

## 3. Verification

- [x] 3.1 Manually verify: navigate from `/admin/lists` → click description link → `/lists?load=XXX` loads without CPU spike
- [x] 3.2 Manually verify: navigate from `/lists` → click "Admin" in MainNav → `/admin` loads without CPU spike
- [x] 3.3 Run `npm test` and `npm run typecheck` to confirm no regressions
