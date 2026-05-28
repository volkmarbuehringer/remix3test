## 1. Streaming Helpers

- [ ] 1.1 Create `app/router.test.ts` with `readChunks(stream)`, `readUntil(chunks, predicate)`, and `countTemplates(html)` helper functions patterned on the frames-demo implementation
- [ ] 1.2 Add a `extractCookie(response)` helper (matching the pattern from `admin-fragments-controller.test.ts`) for extracting session cookies from login responses

## 2. Admin Page Streaming Test

- [ ] 2.1 Add a `describe('Admin page streaming')` block with a `before` hook that authenticates as the admin user via `POST /login`
- [ ] 2.2 Add test verifying fallback content streams before frame content: request `/admin`, consume stream chunks, assert initial chunk has admin sidebar content (e.g., "Admin", nav items) but no `<template>` tags
- [ ] 2.3 Add test verifying frames resolve progressively: continue consuming the stream, assert that `<template>` tags appear and stats/activity content eventually arrives

## 3. AI Page Streaming Test

- [ ] 3.1 Add a `describe('AI page streaming')` block with a `before` hook that authenticates as a regular user via `POST /login`
- [ ] 3.2 Add test verifying fallback content streams before frame content: request `/ai`, consume stream chunks, assert initial chunk has AI sidebar content (e.g., "AI", nav items) but no `<template>` tags
- [ ] 3.3 Add test verifying AI frame resolves: continue consuming, assert `<template>` tags appear and AI dashboard content arrives

## 4. Fragment Endpoint Tests

- [ ] 4.1 Add test verifying `/admin/fragments/stats` returns standalone stats content (no `<html>` wrapper, contains server time/uptime)
- [ ] 4.2 Add test verifying `/admin/fragments/recent-activity` returns standalone activity content
- [ ] 4.3 Add test verifying `/ai/fragments/agent-result?prompt=test` returns standalone agent result content
- [ ] 4.4 Add test verifying fragment endpoints reject unauthenticated requests with 302 redirect

## 5. Verify

- [ ] 5.1 Run `npm run typecheck` to verify no type errors
- [ ] 5.2 Run `npm test` and confirm all tests pass, including the new streaming tests
