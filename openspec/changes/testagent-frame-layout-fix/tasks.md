## 1. Controller rendering fix

- [x] 1.1 Add `renderAdminPage`, `AdminLayout` imports and `frames` ref to test-agent controller
- [x] 1.2 Add frame detection and dual rendering path in `index` action (frame → `renderAdminPage`, direct → `Layout > AdminLayout > TestAgentPage`)

## 2. Navbar cleanup

- [x] 2.1 Remove `{ label: 'Test-Agent', href: '/testagent' }` from `NAV_SECTIONS` in `app/ui/nav.ts`
- [x] 2.2 Remove `{ label: 'Test-Agent', href: '/testagent', requireAuth: true }` from `MOBILE_ITEMS` in `app/ui/nav.ts`
