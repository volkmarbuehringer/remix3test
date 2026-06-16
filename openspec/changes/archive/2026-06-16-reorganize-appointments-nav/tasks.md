## 1. Nav Data Changes

- [x] 1.1 In `app/ui/nav.ts`, change "Termine" href in `NAV_SECTIONS` from `/appointment` to `/appointments/new`
- [x] 1.2 In `app/ui/nav.ts`, add `{ label: 'TermineUI', href: '/appointment' }` to `NAV_SECTIONS` items

## 2. Test Updates

- [x] 2.1 In `app/ui/nav.test.ts`, update `NAV_SECTIONS` tests: `/appointments/new` for "Termine", add "TermineUI" href assertion
- [x] 2.2 Run `npm test` to verify all tests pass
