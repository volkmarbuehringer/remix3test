## 1. Add Diagnostic Logging

- [x] 1.1 Add `console.log('[SSE] fwd:', type)` inside `fwd()` function in `app/utils/agent-sse.ts`
- [x] 1.2 Add `console.log('[SSE] QUESTION:', ...)` inside `tool-call-suspended` handler in `app/utils/agent-sse.ts`
- [x] 1.3 Run typecheck to confirm no type errors

## 2. Diagnose and Fix

- [x] 2.1 Reproduce: confirm `question` SSE event IS emitted — bug is client-side (unselected radio)
- [x] 2.2 Auto-select single option in `showQuestion` (workflow-agent-stream.tsx, route-agent-stream.tsx)
- [x] 2.3 Remove the two diagnostic `console.log` lines from `app/utils/agent-sse.ts`
