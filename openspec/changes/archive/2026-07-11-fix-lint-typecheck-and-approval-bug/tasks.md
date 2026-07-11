## 1. Fix typecheck errors

- [x] 1.1 Fix `test-tools.test.ts` — cast `execute` to typed function with correct 2-argument signature and proper return type

## 2. Fix lint errors

- [x] 2.1 Fix `test-agent/controller.tsx:50` — use canonical header name `'X-Forwarded-For'`
- [x] 2.2 Fix `stream-store.ts:18` — change `let` to `const` for module-scoped `store`
- [x] 2.3 Fix `test-tools.ts:7` — change `let` to `const` for module-scoped `projectRoot`

## 3. Fix approval bug

- [x] 3.1 Fix `test-agent/controller.tsx:70` — change `requireToolApproval` callback to check `ctx.toolName === 'readTestFile'`
- [x] 3.2 Fix `test-agent/controller.tsx:86-169` — change SSE stream handler to read from `fullStream` and handle `tool-call-approval` chunks (textStream never closed when tool suspended, causing stall)

## 4. Fix completedStream format

- [x] 4.1 Fix `test-agent/controller.tsx:16-34` — change `completedStream.fullStream` to emit typed Mastra chunks (`text-delta`, `finish`) instead of raw bytes, matching the new SSE handler

## 5. Verify

- [x] 5.1 Run `npm run typecheck` — confirm zero errors
- [x] 5.2 Run `npm run lint` — confirm zero warnings and errors
- [x] 5.3 Run tests — confirm all test-agent and test-tools tests pass (11/11)
