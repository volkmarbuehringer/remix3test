## 1. Workspace Config

- [x] 1.1 Enable additional workspace tools in the Workspace constructor: WRITE_FILE, EDIT_FILE, DELETE, MKDIR, GREP, FILE_STAT — all with requireApproval: true except FILE_STAT (no approval). Add requireReadBeforeWrite on WRITE_FILE.

- [x] 1.2 Update the agent `instructions` string to document the new tools with usage guidance.

## 2. Verification

- [x] 2.1 Run `npm run typecheck` to verify no type errors.
- [x] 2.2 Run `npm test` to verify existing tests still pass.
- [x] 2.3 Run `npm run lint` to verify no lint issues.
