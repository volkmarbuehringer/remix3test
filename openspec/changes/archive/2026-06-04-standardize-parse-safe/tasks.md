## 1. Fix Latent Bugs — Controllers with bare s.parse()

- [x] 1.1 Add `parseSafe` to `agent-controller.tsx` — guard `messageSchema` parse, return 400 on failure, place before existing try/catch for AI calls
- [x] 1.2 Add `parseSafe` to `chat-controller.tsx` — guard `messageSchema` parse, return 400 on failure, place before existing try/catch for AI calls
- [x] 1.3 Add `parseSafe` to `admin-messages-controller.tsx` — guard `messageSchema` parse, return 400 on failure

## 2. Refactor try/catch → parseSafe

- [x] 2.1 Refactor `auth-login-controller.tsx` — replace `s.parse(loginSchema)` + try/catch with `s.parseSafe` + `issuesToFieldErrors`
- [x] 2.2 Refactor `auth-register-controller.tsx` — replace `s.parse(registerSchema)` + try/catch with `s.parseSafe` + `issuesToFieldErrors`
- [x] 2.3 Refactor `admin-users-controller.tsx` — replace 3 `s.parse()` + try/catch sites (create, update, destroy) with `s.parseSafe` + `issuesToFieldErrors`
- [x] 2.4 Refactor `lists-controller.tsx` — replace 2 form-validation `s.parse()` sites (L46, L102) with `s.parseSafe` + `issuesToFieldErrors`; leave query param parsing (L79, L134) unchanged
- [x] 2.5 Refactor `workflow-controller.tsx` — replace `s.parse(workflowSchema)` + try/catch with `s.parseSafe` + `issuesToFieldErrors`

## 3. Upgrade Generic Errors to Field-Level

- [x] 3.1 Upgrade `appointtype-controller.tsx` — replace generic "Validation failed." with `issuesToFieldErrors(parsed.issues)` for both create and update actions
- [x] 3.2 Upgrade `appointment-controller.tsx` — replace generic "Validation failed." with `issuesToFieldErrors(parsed.issues)` for both create and update actions

## 4. Add Field-Level Error Rendering to AuthForm

- [x] 4.1 Add `AuthFormErrors` type and `errors` prop to `AuthForm` in `app/ui/auth-card.tsx`
- [x] 4.2 Add `fieldErrorCss` export with correct color token (`theme.colors.action.danger.foreground`)
- [x] 4.3 Add `aria-invalid`, `aria-describedby`, and inline error `<span>` rendering to `LoginPage` in `auth-login-controller.tsx` for email and password fields
- [x] 4.4 Add `aria-invalid`, `aria-describedby`, and inline error `<span>` rendering to `RegisterPage` in `auth-register-controller.tsx` for name, email, and password fields

## 5. Verification

- [x] 5.1 Run `npm run typecheck` and fix any type errors
- [x] 5.2 Run `npm test` and ensure no regressions
- [x] 5.3 Manually verify: Login with empty fields shows per-field errors with aria attributes
- [x] 5.4 Manually verify: Register with invalid email shows field-level error
- [x] 5.5 Manually verify: Admin user create with missing fields shows field-level errors
- [x] 5.6 Manually verify: Agent/chat/admin-messages controllers no longer crash on invalid input
- [x] 5.7 Manually verify: Lists controller pagination still works (query param parsing unchanged)
- [x] 5.8 Manually verify: Appointtype/appointment create with invalid data shows field errors instead of "Validation failed."
