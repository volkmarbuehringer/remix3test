## Context

The slot picker is rendered client-side in `customer-chat-stream.tsx:appendSlotPicker()` as standalone DOM after the agent's tool result for `find_next_available_slots`. It is not a suspended dialog — the agent turn has completed. Clicking a slot calls `handleSlotClick()` which sends a POST to `/chat` with a booking message, starting a new agent turn.

There is currently no affordance to exit the slot picker other than clicking a slot or typing free text. The agent holds the prior search context in its working memory, so it can re-offer resources if asked — but the user must know to ask.

## Goals / Non-Goals

**Goals:**

- Add an "Andere Ressource" button to the slot picker that triggers the agent to re-offer remaining resources from the previous search
- Add a "Schließen" button that removes the picker and re-enables the text input (client-side only)
- Add an agent instruction so the agent handles "other resource" requests by re-searching with the same query terms
- Preserve all existing slot picker behavior (slot click, pagination, booking flow)

**Non-Goals:**

- Changing the slot picker's visual layout beyond adding two buttons
- Caching resource lists client-side (the agent re-searches)
- Multi-turn "back" navigation (only one level: back from slots to resource selection)
- Changes to workflows, tools, or the booking/cancel logic
- Changes to the manual booking wizard (`appointments-new`)

## Decisions

### 1. "Andere Ressource" sends a message to the agent

Send a new user message rather than trying to restore state client-side. This is consistent with how slot clicks work and keeps the agent as the source of truth.

- Button click appends `"Ich möchte eine andere Ressource ausprobieren."` as a user bubble
- POSTs to `/chat` with the message, same path as `handleSlotClick`
- The agent receives this in context of the conversation (it knows the previous search, the resources found, and which one was just shown)
- Agent needs one instruction line: when user asks for another resource during slot display, re-search with same terms and present results

### 2. "Schließen" is client-side only

Button simply removes the slot picker DOM element and re-enables the form input. No agent interaction. The user can then type whatever they want.

### 3. Button placement

Both buttons sit below the pagination controls, right-aligned, with a subtle divider to separate them from slot choices:

```
[14:00] [15:00] [16:00]

← Zurück   Seite 1/3   Weiter →
──────────────────────────────
[Andere Ressource]  [Schließen]
```

### 4. Agent instruction mirrors the post-booking pattern

Existing post-booking instruction (line 51 of `customer-agent.ts`):

```
Wenn der Kunde mit "Ja" antwortet: Durchsuche SOFORT search_resources_by_capability
mit den GLEICHEN Suchbegriffen wie in der vorherigen Suche.
```

New instruction follows the same structure for the "other resource" case.

## Risks / Trade-offs

- **[Agent may misinterpret the request]** → The instruction is explicit: "wenn der Kunde eine andere Ressource ausprobieren möchte, während Terminslots angezeigt wurden." This is a narrow, high-confidence trigger.
- **[Single-resource search has no alternatives]** → The tool will return no results for the re-search (same terms, same single resource). The existing no-slot-fallback handles this: "Keine weiteren Ressourcen gefunden. Starten Sie eine neue Suche."
- **[User might click both buttons rapidly]** → Same debounce as slot clicks — the form is disabled after the first POST, preventing double-submission.
