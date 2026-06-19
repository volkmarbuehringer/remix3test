## Why

After a password reset or password change, existing sessions on other devices remain valid indefinitely because the auth middleware only checks that the user exists and is verified — it never checks whether the password was changed after the session was issued. This means a compromised session cookie stays valid even after the user changes their password.

## What Changes

- Add `token_version` column to the `users` table, incremented on every password change
- Store the current `token_version` in session auth data at login time
- Check `token_version` match during auth verification — if the user's tv in DB is higher than the session's tv, invalidate the session
- Regenerate session ID after password reset (currently missing)
- Re-issue auth with new tv on the settings password change page so the current device stays logged in

## Capabilities

### New Capabilities

- `session-token-version`: Add token_version-based session invalidation that kicks all other sessions when a password changes

### Modified Capabilities

- `verwaltung-dashboard`: admin user management — password changes via admin panel must also increment `token_version`

## Impact

- `app/data/migrate.ts` — add column migration
- `app/data/schema.ts` — add `token_version` column definition
- `app/data/seed.ts` — seed with `token_version: 1` (or let migration default handle it)
- `app/middleware/auth.ts` — update `AppAuthSession` type, `parseAppAuthSession`, and `verify()`
- `app/actions/auth/controller.tsx` — login sets tv, password reset increments tv + regenerates session
- `app/actions/settings/controller.tsx` — password change increments tv, re-issues auth on current session
- `app/actions/admin/users/controller.tsx` — admin password changes also increment tv
