## Why

newapp uses Remix 3's Frame system throughout — admin pages load content via `<Frame name="adminContent">`, AI pages via `<Frame name="aiContent">`, and nested fragments stream stats, activity, chatlog details, and agent results. Despite this heavy reliance on frames, there are zero tests that verify frames actually stream correctly: that fallback content appears first, that frame content arrives progressively, that `<template>` tags structure the stream properly, and that broken frame endpoints don't silently produce empty content. The `frames-demo` project has precisely this kind of test (`router.test.ts`) and it's caught real issues during development. newapp needs the same safety net.

## What Changes

- **Create `app/router.test.ts`** — An integration test that exercises the frame streaming pipeline end-to-end
- **Add tests for each section's frame rendering**:
  - Admin page (`/admin`) — verifies fallback content streams first, then frame content with `<template>` tags
  - AI page (`/ai`) — verifies the same streaming pattern for the AI section
  - Admin fragment endpoints — verifies `/admin/fragments/stats`, `/admin/fragments/recent-activity`, and `/admin/fragments/user-detail/:id` render correctly as frame fragments without Layout wrappers
  - AI fragment endpoint — verifies `/ai/fragments/agent-result` renders correctly as a frame fragment
  - Admin chatlog fragment — verifies `/admin/chatlog/fragments/detail/:id` renders correctly as a client-mounted frame fragment
  - Nested frame content — verifies that frames inside frames (e.g., stats and activity inside the admin dashboard) eventually resolve
  - Error handling — verifies that non-existent fragment URLs produce useful error content rather than silent emptiness
- **Add test utilities** for consuming streaming responses (`readChunks`, `readUntil`) — patterned after `frames-demo`'s proven helpers

## Capabilities

### New Capabilities

- `frame-streaming-tests`: Integration test suite that validates the end-to-end frame streaming pipeline — fallback rendering, incremental frame resolution via `<template>` tags, fragment endpoint isolation, nested frame composition, and error handling for broken frame targets.

### Modified Capabilities

_(None — no existing spec requirements change.)_

## Impact

**Files created:**

- `app/router.test.ts` — Main integration test for frame streaming

**Files affected (indirectly — tests exercise existing endpoints, no code changes):**

- `app/middleware/render.tsx` — (no change) tested via router integration
- `app/actions/admin-fragments-controller.tsx` — (no change) tested via router integration
- `app/actions/admin-chatlog-fragments-controller.tsx` — (no change) tested via router integration
- `app/actions/ai-fragments-controller.tsx` — (no change) tested via router integration

No production code changes. This is purely a test addition.
