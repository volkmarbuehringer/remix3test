## Context

The customer agent uses Mastra's streaming API. When a booking succeeds, the agent calls `askUserTool("Möchten Sie einen weiteren Termin buchen?")` with options "Ja, weitermachen" / "Nein, fertig". This suspends the stream via `tool-call-suspended`.

The client-side `handleAnswer()` sends `POST /chat/answer` which calls `agent.resumeStream(answer, { runId, toolCallId })`. The controller stores the resumed `MastraModelOutput.fullStream` keyed by its `runId`, then returns `{ runId }` to the client.

**The real problem – vague agent instruction:** The instruction says `"Bei 'Ja' starte eine neue Suche"` but doesn't tell the agent what to search for. The agent can't produce `searchResourcesByCapability` arguments without a query, so it either outputs empty text or falls back to a free-text question requiring manual typing. The stream delivery from `resumeStream` works correctly — the controller accesses `fullStream` synchronously before Mastra's internal `startBroadcast` (async `.then()`), so the race condition does not cause visible issues. SSE event byte counts (~3-4) in logs represent initial HTTP response overhead, not empty streams.

## Goals / Non-Goals

**Goals:**
- Reliable stream delivery from `resumeStream` — the client receives the agent's full response after answering "yes"
- Agent automatically searches for resources using the previous search query and presents options via `askUserTool` — no free-text input required from the user
- Preserve existing flow for the first booking (no regression)

**Non-Goals:**
- Changing Mastra framework internals (the fix is in our controller, not in node_modules)
- Multi-session or cross-thread search memory (only same-conversation context reuse)

## Decisions

### 1. Buffer `fullStream` to avoid race with `registerRun`

`MastraModelOutput.fullStream` may be partially consumed by Mastra's internal `registerRun` → `startBroadcast` before the controller stores it (race condition dependent on microtask timing). When this happens, the stored stream produces negligible SSE data (~2 bytes) and the client receives no events.

Fix: Read all parts from `output.fullStream` into a buffer synchronously, then create a new `ReadableStream` from the buffer:

```
let parts = []
let reader = output.fullStream.getReader()
while (true) {
  let { done, value } = await reader.read()
  if (done) break
  parts.push(value)
}
let bufferedStream = new ReadableStream({
  start(controller) {
    for (let part of parts) controller.enqueue(part)
    controller.close()
  }
})
setStream(output.runId, { fullStream: bufferedStream, ... })
```

This guarantees all stream events are captured regardless of `startBroadcast` timing. Buffer size is bounded by the agent's response (typically <100KB).

**Keep `output.runId`** — generating a fresh runId breaks the resume chain because Mastra's snapshot system keys by runId, and the SSE `question` event carries `stored.runId`.

### 2. Sharpen the agent instruction

Replace:
```
- Wenn eine Buchung erfolgreich war: Frage den Kunden mit ask_user "Möchten Sie einen weiteren Termin buchen?" mit den Optionen "Ja, weitermachen" und "Nein, fertig". Bei "Ja" starte eine neue Suche.
```

With:
```
- Wenn eine Buchung erfolgreich war: Frage den Kunden mit ask_user "Möchten Sie einen weiteren Termin buchen?" mit den Optionen "Ja, weitermachen" und "Nein, fertig". Wenn der Kunde mit "Ja" antwortet: Durchsuche SOFORT search_resources_by_capability mit den GLEICHEN Suchbegriffen wie in der vorherigen Suche. Präsentiere die Ergebnisse mit ask_user zur Auswahl. Wenn keine weiteren Ressourcen verfügbar sind, informiere den Kunden freundlich.
```

This tells the agent to reuse the previous search context rather than requiring new input.

## Risks / Trade-offs

- **[New runId hides the symptom, not the root cause]** → The race in Mastra's `registerRun` still exists; if a future Mastra version starts consuming `fullStream` synchronously, we'd notice immediately (new runId avoids collision)
- **[Previous search query may be stale]** → The agent might recommend a resource that was already booked. This is acceptable — if no slots are found, the existing no-slot fallback (offer other resources) handles it
- **[Working memory dependency]** → The fix relies on Mastra's `workingMemory` preserving the previous search context. The agent already has `memory` with `workingMemory: { enabled: true }`, so this is the current behavior
