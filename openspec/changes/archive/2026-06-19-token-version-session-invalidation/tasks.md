## 1. Schema & Migration

- [x] 1.1 Add `token_version: c.integer()` to the users table definition in `app/data/schema.ts`
- [x] 1.2 Add migration in `app/data/migrate.ts`: `ALTER TABLE users ADD COLUMN IF NOT EXISTS token_version INTEGER NOT NULL DEFAULT 1`
- [x] 1.3 Set `token_version: 1` on seed users in `app/data/seed.ts`

## 2. Auth Middleware — token_version check

- [x] 2.1 Update `AppAuthSession` interface in `app/middleware/auth.ts` to `{ userId: number; tv: number }`
- [x] 2.2 Update `parseAppAuthSession()` to extract `tv` from session data (return null if missing)
- [x] 2.3 Update `verify()` to check `user.token_version === session.tv`, return null on mismatch

## 3. Login — store tv in session

- [x] 3.1 Update `session.set('auth', ...)` in login handler to include `tv: user.token_version`

## 4. Password Reset — increment tv + regenerate session

- [x] 4.1 Read current `token_version` before the update, write `token_version: currentTv + 1` in the password reset update
- [x] 4.2 Add `session.regenerateId(true)` before `session.unset('auth')`

## 5. Settings — increment tv + re-issue auth

- [x] 5.1 Read current `token_version`, write `token_version: currentTv + 1` in the settings password change update
- [x] 5.2 After the update, re-read the user and `session.set('auth', { userId, tv: newTv })` so the current device stays logged in

## 6. Admin User Management — increment tv

- [x] 6.1 In the admin `create` handler, set `token_version: 1` on the new user (migration default handles it, but be explicit)
- [x] 6.2 In the admin `update` handler, when `fields.password` is provided, also increment `token_version` by reading the current user value first

## 7. Tests

- [x] 7.1 Update existing auth tests that verify login session data to include `tv`
- [x] 7.2 Add test: session without tv is rejected
- [x] 7.3 Add test: session with wrong tv is rejected
- [x] 7.4 Add test: password reset logs out other sessions (if test infrastructure allows)
- [x] 7.5 Add test: settings password change keeps current session alive but logs out others (if test infrastructure allows)
