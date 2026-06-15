## 1. Shared helper

- [x] 1.1 Create `app/utils/get-page-size.ts` with `getPageSize(context, defaultSize)` that reads `session.get('pageSize')` and validates it against `[10, 15, 20, 25, 50]`

## 2. Settings page

- [x] 2.1 Add a page size section to the settings page UI with a `<select>` dropdown (10, 15, 20, 25, 50) and preselection logic
- [x] 2.2 Add `_action = 'set-page-size'` handler in the settings controller that validates and stores the value in session

## 3. Wire override into all paginated controllers

- [x] 3.1 `app/actions/admin/users/controller.tsx` — import `getPageSize`, replace `USERS_PAGE_SIZE` with `getPageSize(context, USERS_PAGE_SIZE)`
- [x] 3.2 `app/actions/admin/messages/controller.tsx` — same pattern for `MESSAGES_PAGE_LIMIT`
- [x] 3.3 `app/actions/admin/lists/controller.tsx` — same pattern for `LISTS_PAGE_LIMIT`
- [x] 3.4 `app/actions/admin/chatlog/controller.tsx` — same pattern for `CHATLOG_PAGE_SIZE`
- [x] 3.5 `app/actions/client/controller.tsx` — same pattern for `PAGE_SIZE`
- [x] 3.6 `app/actions/nutzer/controller.tsx` — same pattern for `PAGE_SIZE`
- [x] 3.7 `app/actions/appointments-new/controller.tsx` — same pattern for `PAGE_SIZE`
- [x] 3.8 `app/actions/verwaltung/appointments/controller.tsx` — same pattern for `APPOINTMENTS_PAGE_SIZE`
- [x] 3.9 `app/actions/verwaltung/offerings/controller.tsx` — same pattern for `OFFERINGS_PAGE_SIZE`
- [x] 3.10 `app/actions/verwaltung/offering-configs/controller.tsx` — same pattern for `OFFERING_CONFIGS_PAGE_SIZE`
- [x] 3.11 `app/actions/verwaltung/resources/controller.tsx` — same pattern for `RESOURCES_PAGE_SIZE`
- [x] 3.12 `app/actions/verwaltung/report1/controller.tsx` — same pattern for `REPORT1_PAGE_SIZE`
- [x] 4.1 Run `npm run typecheck`
- [x] 4.2 Run `npm test`
