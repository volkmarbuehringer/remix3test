## Why

Users currently have no way to change their password while logged in — the only password reset option is the email-based "forgot password" flow. A dedicated user settings page gives users control over their account credentials.

## What Changes

- Add a new route `/settings` with a user settings page
- Add a password change form on the settings page with complexity validation (min 10 chars, must include numbers and special characters)
- Add a settings icon with tooltip in the main navigation, next to the logout button
- Add a new `user-settings` capability and controller

## Capabilities

### New Capabilities

- `user-settings`: User settings page with password change functionality, including complexity validation and navigation entry

### Modified Capabilities

- _(none — no existing specs change)_

## Impact

- New route `/settings` added to the route tree
- New controller at `app/actions/settings/controller.tsx`
- New page component in `app/actions/settings/` or `app/ui/`
- Main navigation (`app/ui/main-nav.tsx`) updated with settings icon + tooltip
- Password complexity rule: minimum 10 characters, requires at least one number and one special character
