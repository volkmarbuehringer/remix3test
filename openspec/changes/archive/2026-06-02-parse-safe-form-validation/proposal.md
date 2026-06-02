## Why

The `/client` CRUD lab already uses Remix 3's `parseSafe` + re-render-from-POST pattern but still carries legacy inline validation mixed with schema checks. The admin routes (`/admin/offerings`, `/admin/appointments`) use hand-written `validateXForm()` functions wrapped around `s.parse()` try/catch — fragile, boilerplate-heavy, and the catch block loses grid state on parse errors. Remix 3's `timeboxer` demo demonstrates a cleaner path: one declarative `.refine()` schema replaces both the parse step AND all custom validation. This change standardizes all form validation across the app on that pattern.

## What Changes

- Extract shared `issuesToFieldErrors()` utility for mapping `parseSafe` issues to per-field error records
- Extract shared `readFormFieldValues()` utility for reading raw FormData values before coercion
- Replace `s.parse()` + try/catch + `validateOfferingForm()` in `admin-offerings-controller.tsx` with `s.parseSafe(offeringSaveSchema)` containing in-schema `.refine()` rules
- Replace `s.parse()` + try/catch + `validateAppointmentForm()` in `admin-appointments-controller.tsx` with `s.parseSafe(appointmentSaveSchema)` containing in-schema `.refine()` rules
- Refine `/client` controller schema to move remaining inline validation into `.refine()` chains
- Define shared offering and appointment form schemas in `app/utils/offering-schema.ts` and `app/utils/appointment-schema.ts`
- Extract shared validation utilities in `app/utils/schema-utils.ts`
- **BREAKING**: The `admin-offerings-form-validation` spec currently mandates re-render-from-POST for per-field errors. This is architecturally impossible with `createSidebarLayout` (ShellOrFragment discards children on non-frame requests). The spec requirements are updated to reflect the working redirect + URL-param pattern.

## Capabilities

### New Capabilities

- `shared-schema-validation`: Shared `issuesToFieldErrors()` and `readFormFieldValues()` utilities in `app/utils/schema-utils.ts` covering `parseSafe` issue mapping and raw FormData extraction across all controllers.
- `offering-form-schema`: Declarative `offeringSaveSchema` with `.refine()` rules replacing `validateOfferingForm()` — defined once in `app/utils/offering-schema.ts`, used by admin-offerings controller.
- `appointment-form-schema`: Declarative `appointmentSaveSchema` with `.refine()` rules replacing `validateAppointmentForm()` — defined once in `app/utils/appointment-schema.ts`, used by admin-appointments controller.
- `client-form-schema-refinement`: Move remaining inline validation from client controller actions into `.refine()` chains on `clientSaveSchema`.

### Modified Capabilities

- `admin-offerings-form-validation`: Requirement changed from "re-render from POST" to "redirect with grid-state-preserving URL params after validation failure" for per-field errors. The previous spec presumed re-render-from-POST which is incompatible with frame-based admin layouts. Form values are now read from decoded URL params (`fv_*`), not `context.formData`.

## Impact

- `newapp/app/utils/schema-utils.ts` — new shared utility (issuesToFieldErrors, readFormFieldValues)
- `newapp/app/utils/offering-schema.ts` — new shared schema for offerings validation
- `newapp/app/utils/appointment-schema.ts` — new shared schema for appointments validation
- `newapp/app/actions/admin-offerings-controller.tsx` — switch to parseSafe + offering-schema, remove validateOfferingForm
- `newapp/app/actions/admin-appointments-controller.tsx` — switch to parseSafe + appointment-schema, remove validateAppointmentForm
- `newapp/app/actions/client/controller.tsx` — refine schema, remove inline validation
- `openspec/specs/admin-offerings-form-validation/spec.md` — delta update for redirect pattern
