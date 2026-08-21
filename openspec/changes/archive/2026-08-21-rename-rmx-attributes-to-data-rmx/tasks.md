## 1. Rename attributes in shared UI primitives

- [x] 1.1 Rename `rmx-src`, `rmx-target`, `rmx-document` keys to `data-rmx-*` in `app/ui/nav-link.tsx`'s `extra` record and verify `rg 'rmx-' app/ui/nav-link.tsx` returns no bare `rmx-` attribute keys (the `Record<string, string>` spread is untypechecked, so this is hand-verified)
- [x] 1.2 Rename `rmx-document` to `data-rmx-document` in `app/assets/frame-response.browser.tsx` and verify the attribute renders as `data-rmx-document` in the frame response anchor

## 2. Rename attributes across admin UI pages

- [x] 2.1 Rename `rmx-target` → `data-rmx-target`, `rmx-history` → `data-rmx-history`, `rmx-document` → `data-rmx-document` in the admin pages under `app/ui/` (admin-appointments-page, admin-appointments-form, admin-chatlog-page, admin-lists-page, admin-messages-page, admin-nutzer-{create,edit,page}, admin-offering-configs-page, admin-offerings-{config,create,edit,page,week}-page, admin-report1-page, admin-resources-page, admin-users-page) and verify `npm test` still passes
- [x] 2.2 Rename `rmx-target`/`rmx-document` in `app/ui/lists-layout.tsx`, `app/ui/main-nav.tsx`, `app/ui/verwaltung-page.tsx` and verify the cross-section `rmx-document` escape and frame-targeted nav still compile and render correctly

## 3. Rename attributes in actions-owned pages and tests

- [x] 3.1 Rename `rmx-target`/`rmx-document`/`rmx-history` in `app/actions/client/create-page.tsx`, `app/actions/client/edit-page.tsx`, `app/actions/client/grid-page.tsx`, `app/actions/lists/public/list-name-edit.tsx` and verify `npm run typecheck` passes
- [x] 3.2 Update `rmx-target`/`rmx-history` assertions in `app/actions/client/grid-page.test.ts`, `app/actions/lists/controller.test.ts`, `app/actions/nutzer/controller.test.tsx` to the `data-rmx-*` names and verify those test files pass

## 4. Update learned skill deltas

- [x] 4.1 Update `remix3-frame-cliententry/SKILL.md` references from `rmx-*` to `data-rmx-*` (including the new `<form data-rmx-document>` capability) and verify no bare `rmx-` attribute names remain in the skill
- [x] 4.2 Update `remix-forms/SKILL.md` and `remix-route-relocation/SKILL.md` `rmx-*` references to `data-rmx-*` and verify no bare `rmx-` attribute names remain in either skill

## 5. Verification

- [x] 5.1 Run `npm test` and `npm run typecheck` and confirm both pass with zero `rmx-` attribute references remaining in `app/` (`rg 'rmx-(target|src|document|history|reset-scroll|preserve-dom)' app/` returns nothing)
- [ ] 5.2 Manually verify frame navigation behavior: admin grid filter navigation (replace history), a frame-targeted link navigation, and an `rmx-document` escape (download or cross-section link) all behave as before the rename