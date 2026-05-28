## 1. Auth protection for /client/* routes

- [x] 1.1 Add `import { requireAuth } from '../middleware/auth.ts'` to `app/actions/client/controller.tsx`
- [x] 1.2 Add `middleware: [requireAuth()]` to the `createController` call in `app/actions/client/controller.tsx`
- [x] 1.3 Verify client CRUD routes redirect unauthenticated requests to `/login`
- [x] 2.4 Verify `/lists` and `/lists/:id` redirect unauthenticated requests with proper `returnTo` handling
- [x] 5.1 Run typecheck (`tsc --noEmit`) to catch any type errors
- [x] 5.2 Run existing auth tests: `remix test` (focus on `app/middleware/auth.test.ts`)
- [x] 5.3 Verify login flow still works end-to-end (login → redirect to home with valid session)
- [x] 5.4 Verify logout clears session and redirects to home
