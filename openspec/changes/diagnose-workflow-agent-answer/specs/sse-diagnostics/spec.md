## ADDED Requirements

### Requirement: Server-side SSE event logging

The system SHALL log every SSE event type and question payload to the server console.

#### Scenario: Every fwd() call logs the event type

Given a Mastra agent stream chunk enters `filterAndForward`
When `fwd()` is called with the event type
Then `console.log('[SSE] fwd:', type)` fires before the SSE encode

#### Scenario: Question payload is logged

Given a `tool-call-suspended` chunk with a `suspendPayload.question`
When the `question` event is emitted
Then `console.log('[SSE] QUESTION: ...')` fires with question text, options count, and selectionMode

### Requirement: Cleanup

The diagnostic logs SHALL be removed after reproduction.

#### Scenario: Diagnostic logs are removed

Given reproduction confirms the root cause
When the cleanup commit is created
Then the two `console.log` lines are no longer present in `app/utils/agent-sse.ts`
