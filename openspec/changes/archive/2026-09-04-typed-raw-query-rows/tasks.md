## 1. Row decoding helper

- [x] 1.1 Add `app/data/rows.ts` with `queryRows`/`queryRow` (wrap `db.exec`, zod-parse each row, `queryRow` returns `undefined` on zero rows) and a thin error wrapper naming the failing statement and row index; verify `app/data/rows.test.ts` covers multi-row, single-row, empty-result, and schema-violation cases and `npm run typecheck` passes
- [x] 1.2 Add the aggregate coercion helper/pattern (`z.coerce.number()` for `count`/`min`/`max`/`sum`/`avg` over int8) and verify a test asserts an int8 aggregate decodes to a number

## 2. Migrate core query files

- [x] 2.1 `app/data/appointments.ts`: replace `AppointmentRow`, `AppointmentsNewRow`, `ResourceOption`, `AppointmentResourceOption`, `AppointmentUserOption` interfaces and their `as unknown as` casts with co-located zod schemas (id/user_id/resource_id → `z.number()`, date/created_at → `z.string()`); verify existing appointments tests pass and typecheck is clean
- [x] 2.2 `app/data/offerings-queries.ts`: replace `OfferingRow`/`OfferingsResourceOption` interfaces and casts with schemas (`id`/`resource_id` → `z.number()`, `day` → `z.string()`); verify offerings tests pass and typecheck is clean
- [x] 2.3 `app/data/webhook-requests.ts`: replace `WebhookRequestRow` and casts with a schema, keeping `id` → `z.string()` (UUID column) and correcting `created_at`/`callback_received_at` → `z.string()`; verify webhook-requests tests pass and typecheck is clean
- [x] 2.4 `app/data/report1.ts`: replace `Report1Row`/`Report1UserOption` and casts with schemas (`user_id` → `z.number()`, aggregates → `z.coerce.number()`); verify report1 tests pass and typecheck is clean

## 3. Migrate remaining data files

- [x] 3.1 `app/data/notifications.ts` (switch the raw `Notification[]` cast to a wire schema with int8 fields as strings), `appointment.ts` (`UserEmailRow`), `appointofferings.ts`; verify their tests pass and typecheck is clean
- [x] 3.2 `app/data/uploads.ts`, `admin-lists.ts`, `admin-messages.ts`, `pdf.ts`, `user-summary-rows.ts` (map-based `Record<string, unknown>` consumers); verify their tests pass and typecheck is clean
- [x] 3.3 `app/data/offering-configs.ts`, `offering-configs-queries.ts`, `admin-dashboard.ts`, `app-webhook.ts`, `callback.ts`, `lists.ts`, `maintenance.ts`; verify their tests pass and typecheck is clean

## 4. Consumer drift corrections

- [x] 4.1 Remove the `parseInt(row.id)` workaround in `app/actions/verwaltung/appointments/controller.tsx` and fix downstream types where corrected `id: number` simplifies call sites; verify verwaltung/appointments tests pass and typecheck is clean

## 5. Verification

- [x] 5.1 Full gate: `npm run typecheck`, `npm test`, `npm run lint`, and `npm run format` all pass with no remaining raw-query `as unknown as` casts in `app/data/` (note: `npm run format` still flags 22 pre-existing baseline files outside this change; all files touched by this change are format-clean)