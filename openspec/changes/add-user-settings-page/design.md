## Context

The app has an email-based "forgot password" flow (`/auth/forgotten`) but no way for authenticated users to change their password while logged in. The main navigation already has a logout icon with tooltip (`title="Abmelden"` + `Glyph` icon) that follows a form-post pattern with CSRF protection.

## Goals / Non-Goals

**Goals:**
- Provide a `/settings` page accessible to authenticated users
- Allow users to change their password by providing current password + new password
- Enforce password complexity: minimum 10 characters, at least 1 digit, at least 1 special character
- Add a settings navigation entry with icon and tooltip in the main nav bar, next to logout
- Validate complexity on both client and server side

**Non-Goals:**
- Email/password-less auth changes
- Profile editing (name, email, avatar)
- Two-factor authentication
- Account deletion

## Decisions

1. **Separate route `/settings`** rather than a modal — a dedicated page is cleaner for future settings expansion (profile, notifications, etc.) and follows existing full-page route patterns.

2. **Settings icon in nav bar** — reuse the `Glyph` component and `title` tooltip pattern from the logout button. Position the settings link before the logout button in the nav.

3. **Current password confirmation** — require the user to enter their current password to prevent session hijacking from changing the password.

4. **Password complexity validation** — validated on both client (instant feedback) and server (enforcement). Rejects weak passwords before submission to the database.

5. **Reuse existing `hashPassword` utility** at `app/utils/password-hash.ts` — consistent with all existing password operations.

6. **New controller at `app/actions/settings/controller.tsx`** — follows the established controller pattern (uses `createAction` since it's a single route, not a route map).

## Risks / Trade-offs

- **[Complexity rule change] →** If requirements change later (e.g., require uppercase), old passwords won't be re-validated. Mitigation: complexity only applies at change time.
- **[Settings scope creep] →** Starting small (password-only) keeps the first iteration focused. Future settings can be added to the same page/module.
- **[CSRF bypass] →** Mitigation: reuse existing CSRF token pattern from the logout form.
