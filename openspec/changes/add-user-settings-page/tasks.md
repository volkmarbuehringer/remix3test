## 1. Route & Navigation Setup

- [x] 1.1 Add `/settings` route to `app/routes.ts`
- [x] 2.2 Add settings icon with tooltip to main navigation in `app/ui/main-nav.tsx`

## 2. Settings Controller & Page

- [x] 2.1 Create `app/actions/settings/controller.tsx` with GET and POST handlers
- [x] 2.2 Wire the settings controller in `app/router.ts` to the `/settings` route

## 3. Password Complexity Validation

- [x] 3.1 Add server-side password complexity validation utility (min 10 chars, digit, special char)
- [x] 3.2 Add client-side password complexity feedback (real-time checklist)
- [x] 3.3 Wire validation into the settings controller's POST handler

## 4. Password Change Logic

- [x] 4.1 Verify current password against stored `password_hash` in POST handler
- [x] 4.2 Hash new password and update `password_hash` in the database

## 5. Tests

- [x] 5.1 Add password complexity validation tests (server-side)
- [x] 5.2 Add settings controller tests
