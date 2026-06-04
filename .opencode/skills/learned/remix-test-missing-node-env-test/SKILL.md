---
name: remix-test-missing-node-env-test
description: "`remix test` does not auto-set NODE_ENV=test. Guards relying on `NODE_ENV === 'test'` silently don't fire, causing real side effects in tests."
user-invocable: false
origin: auto-extracted
---

# Remix 3: `remix test` Does Not Set `NODE_ENV=test`

**Extracted:** 2026-06-04
**Context:** Tests were passing only when Mailpit (SMTP sandbox) was running. Investigation revealed `NODE_ENV=test` was never set, so email-sending guards didn't fire and `nodemailer` tried real SMTP connections.

## Problem

`remix test` does **NOT** set `NODE_ENV=test` automatically like Jest, Vitest, or most test runners do. Any code guarded by `process.env.NODE_ENV === 'test'` silently evaluates to `false` during tests.

This manifests as:
- Email sending actually attempts SMTP connections (fails if server not running)
- Seed/re-seed guards not firing
- Test-specific database behavior not activating
- Production code paths running in test context

## Root Cause

The `remix test` CLI (`@remix-run/test/dist/cli.js`) spawns Node workers to run test files but never sets `NODE_ENV`. The `.env` file is also not loaded by the test runner (unless the test code explicitly loads it).

## Solution

Add `NODE_ENV=test` to the test script in `package.json`:

```json
"scripts": {
  "test": "NODE_ENV=test remix test"
}
```

After this, guards like the one in the registration controller work as intended:

```ts
// Now actually fires during tests:
if (process.env.NODE_ENV !== 'test') {
  await sendVerificationEmail(context.mailer, user, verificationUrl)
}
```

## When to Use

- Tests fail only when an external dependency (Mailpit, DB seed, paid API) is not running
- Code guarded by `NODE_ENV === 'test'` isn't taking effect during test runs
- Registering a new user in tests triggers real email sending
