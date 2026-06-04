## 1. Fix Latent Bugs — Controllers with bare s.parse()

- [ ] 1.1 Add `parseSafe` to `agent-controller.tsx` — guard `messageSchema` parse, return 400 on failure, place before existing try/catch for AI calls
- [ ] 1.2 Add `parseSafe` to `chat-controller.tsx` — guard `messageSchema` parse, return 400 on failure, place before existing try/catch for AI calls
- [ ] 1.3 Add `parseSafe` to `admin-messages-controller.tsx` — guard `messageSchema` parse, return 400 on failure

## 2. Refactor try/catch → parseSafe

- [ ] 2.1 Refactor `auth-login-controller.tsx` — replace `s.parse(loginSchema)` + try/catch with `s.parseSafe` + `issuesToFieldErrors`
- [ ] 2.2 Refactor `auth-register-controller.tsx` — replace `s.parse(registerSchema)` + try/catch with `s.parseSafe` + `issuesToFieldErrors`
- [ ] 2.3 Refactor `admin-users-controller.tsx` — replace 3 `s.parse()` + try/catch sites (create, update, destroy) with `s.parseSafe` + `issuesToFieldErrors`
- [ ] 2.4 Refactor `lists-controller.tsx` — replace 2 form-validation `s.parse()` sites (L46, L102) with `s.parseSafe` + `issuesToFieldErrors`; leave query param parsing (L79, L134) unchanged
- [ ] 2.5 Refactor `workflow-controller.tsx` — replace `s.parse(workflowSchema)` + try/catch with `s.parseSafe` + `issuesToFieldErrors`

## 3. Upgrade Generic Errors to Field-Level

- [ ] 3.1 Upgrade `appointtype-controller.tsx` — replace generic "Validation failed." with `issuesToFieldErrors(parsed.issues)` for both create and update actions
- [ ] 3.2 Upgrade `appointment-controller.tsx` — replace generic "Validation failed." with `issuesToFieldErrors(parsed.issues)` for both create and update actions

## 4. Add Field-Level Error Rendering to AuthForm

- [ ] 4.1 Add `AuthFormErrors` type and `errors` prop to `AuthForm` in `app/ui/auth-card.tsx`
- [ ] 4.2 Add `fieldErrorCss` export with correct color token (`theme.colors.action.danger.foreground`)
- [ ] 4.3 Add `aria-invalid`, `aria-describedby`, and inline error `<span>` rendering to `LoginPage` in `auth-login-controller.tsx` for email and password fields
- [ ] 4.4 Add `aria-invalid`, `aria-describedby`, and inline error `<span>` rendering to `RegisterPage` in `auth-register-controller.tsx` for name, email, and password fields

## 5. Verification

- [ ] 5.1 Run `npm run typecheck` and fix any type errors
- [ ] 5.2 Run `npm test` and ensure no regressions
- [ ] 5.3 Manually verify: Login with empty fields shows per-field errors with aria attributes
- [ ] 5.4 Manually verify: Register with invalid email shows field-level error
- [ ] 5.5 Manually verify: Admin user create with missing fields shows field-level errors
- [ ] 5.6 Manually verify: Agent/chat/admin-messages controllers no longer crash on invalid input
- [ ] 5.7 Manually verify: Lists controller pagination still works (query param parsing unchanged)
- [ ] 5.8 Manually verify: Appointtype/appointment create with invalid data shows field errors instead of "Validation failed."
