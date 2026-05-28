## 1. Foundation — Add `property: 'db'` to Database Middleware

- [x] 1.1 Add `{ property: 'db' }` to `context.set(Database, db)` in `app/middleware/database.ts`

## 2. Controllers — `context.render` Migration

- [x] 2.1 `app/actions/controller.tsx` — Replace 5x `context.get(Renderer)!` with `context.render`, replace `context.get(Auth)` with `context.auth`
- [x] 2.2 `app/actions/auth-login-controller.tsx` — Replace `context.get(Renderer)` with `context.render`, `getContext().get(Session)` with `context.session`, remove `getContext()` import
- [x] 2.3 `app/actions/auth-register-controller.tsx` — Replace `context.get(Renderer)` with `context.render`, `getContext().get(Session)` with `context.session`, `context.get(FormData)` with `context.formData`, `context.get(Database)` with `context.db`
- [x] 2.4 `app/actions/auth-logout.tsx` — Replace `getContext().get(Session)` with `getContext().session`, remove `Session` import

## 3. AI and Admin Controllers — Render + Data Properties

- [x] 3.1 `app/actions/ai-controller.tsx`, `app/actions/chat-controller.tsx`, `app/actions/agent-controller.tsx` — Replace `get(Renderer)` with `context.render`, `get(FormData)` with `context.formData` where applicable
- [x] 3.2 `app/actions/workflow-controller.tsx` — Replace `get(Renderer)` with `context.render`, `get(Auth)` with `context.auth`, `get(Database)` with `context.db`, `get(FormData)` with `context.formData`
- [x] 3.3 `app/actions/admin-controller.tsx`, `app/actions/admin-chatlog-controller.tsx`, `app/actions/admin-messages-controller.tsx` — Replace `get(Renderer)` with `context.render`, `get(Database)` with `context.db`, `get(FormData)` with `context.formData` where applicable
- [x] 3.4 `app/actions/client/controller.tsx` — Replace `get(Renderer)` with `context.render`, `get(FormData)` with `context.formData`, `getContext().get(Database)` with `context.db`

## 4. Middleware and Utilities

- [x] 4.1 `app/middleware/admin.ts` — Replace `context.get(Renderer)` with `context.render`, `context.get(Auth)` with `context.auth`
- [x] 4.2 `app/middleware/auth.ts` — Replace `context.get(Database)` with `context.db`, `context.get(FormData)` with `context.formData`
- [x] 4.3 `app/utils/context.ts` — Replace `getContext().get(Auth)` with `getContext().auth`
- [x] 4.4 `app/utils/error-handling.ts` — Replace `getContext().get(Session)` with `getContext().session`

## 5. Verify

- [x] 5.1 Remove unused `Renderer`, `Session`, `Database`, `FormData` imports from affected files (those no longer using them for `.get()` access)
- [x] 5.2 Run `pnpm run typecheck` to confirm 0 errors
- [x] 5.3 Run `pnpm test` to confirm all tests pass
