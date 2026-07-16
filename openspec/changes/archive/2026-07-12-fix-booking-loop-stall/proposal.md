## Why

After a customer successfully books an appointment, the agent asks "Möchten Sie einen weiteren Termin buchen?" via `askUserTool`. When the user responds "Ja, weitermachen", the loop stalls — the stream from `resumeStream` produces negligible data (~3 bytes) and the user is left with a re-enabled form instead of a structured resource selection dialog.

This is caused by two independent issues: a technical race condition where `resumeStream` reuses the original `runId` and `registerRun`'s broadcast logic consumes the `fullStream` before the controller stores it, and a design gap where the agent instruction "starte eine neue Suche" is too vague to produce useful output without manual user input.

## What Changes

- **Controller changes** (`app/actions/chat/controller.tsx`): In the `answer` action, generate a fresh random `runId` for the resumed output stream instead of reusing the one returned by `resumeStream`, and pass the correct `toolCallId` from the stored `pendingQuestion` data.
- **Agent instruction change** (`app/actions/mastra/agents/customer-agent.ts`): Sharpens the post-booking instruction to tell the agent to automatically reuse the previous search query and present resource results via `askUserTool`, eliminating the free-text fallback.
- **Client-side change** (`app/assets/customer-chat-stream.tsx`): Pass `toolCallId` from pending question state when posting the answer, so the controller always has the correct suspension context.

## Capabilities

### New Capabilities

- `booking-loop-resumption`: Reliable post-booking loop continuation — after the user agrees to another booking, the agent automatically searches for resources using the previous query context and presents options via `askUserTool` without requiring free-text input.

### Modified Capabilities

_(No existing capabilities have requirement changes — this is a bugfix within the existing customer-agent streaming design.)_

## Impact

- **`app/actions/chat/controller.tsx`**: `answer` action returns a fresh runId; `action` action also updated to pass `toolCallId` for consistency
- **`app/actions/mastra/agents/customer-agent.ts`**: Revised instruction for the post-yes flow
- **`app/assets/customer-chat-stream.tsx`**: `handleAnswer` sends `toolCallId` from `pendingQuestion`
