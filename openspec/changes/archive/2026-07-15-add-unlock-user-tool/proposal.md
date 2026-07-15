## Why

The support agent can cancel (permanently disable) user accounts but has no way to re-enable a disabled account or check a user's lock status. This forces admins to use manual DB queries or legacy admin interfaces to restore access.

## What Changes

- Modify `lookupUser` tool response to include `disabled_at` status
- Add `unlockUserAccount` tool that clears `disabled_at` and resets `token_version` to re-enable a disabled user
- Add `lockUserAccount` tool that sets `disabled_at` without deleting appointments (non-destructive vs. `cancelUserAccount`)

## Capabilities

### Modified Capabilities

- `support-agent-tools`: add `disabled_at` to lookupUser response; add lock/unlock user account tools

## Impact

- `app/actions/mastra/tools/support-tools.ts`: modify `lookupUser` query, add `lockUserAccount` and `unlockUserAccount` tools
- `app/actions/mastra/agents/support-agent.ts`: auto-picks up new tools from `supportTools`
- No data model changes needed — `disabled_at` column already exists on `users` table
- No migration required
