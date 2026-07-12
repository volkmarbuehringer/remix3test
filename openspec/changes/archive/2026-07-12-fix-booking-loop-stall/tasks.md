## 1. Controller — buffer fullStream to avoid race with registerRun

- [x] 1.1 Read all parts from `output.fullStream` into a buffer, create a new `ReadableStream` from the buffer, store in `setStream()`. This avoids the race where `registerRun`'s `startBroadcast` consumes `fullStream` before the controller stores it. Keep the original `output.runId` to maintain the resume chain.

## 2. Agent instructions — automatic search reuse

- [x] 2.1 In `app/actions/mastra/agents/customer-agent.ts`, replace the vague "Bei 'Ja' starte eine neue Suche" instruction with a precise one that tells the agent to reuse the previous search query and present results via `askUserTool`

## 3. Verify

- [x] 3.1 Typecheck passes, chat controller tests pass (16/16)
- [x] 3.2 Manual verification: booking loop works — agent auto-searches with previous terms and presents resource selection via askUserTool
