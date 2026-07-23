## Context

The Workflow Agent currently renders all output into a single `div#agent-bar` element that overwrites previous content on each interaction. The Support Agent uses a `div#chat-messages` container with persistent user/agent chat bubbles, inline tool approval buttons, and error handling. Both agents share the same SSE infrastructure in `app/utils/agent-sse.ts` but have separate browser stream clients with significant code overlap (~70%).

The workflow agent's controller already has routes for `/tool-decision` and `/answer` — the backend plumbing for conversation UX is in place. Only the browser client and page template need changes.

## Goals / Non-Goals

**Goals:**
- Replace the workflow agent's stateless agent bar with a persistent conversation bubble UI
- Add inline approve/decline buttons for tool suspensions (cancel/lock/unlock)
- Add frame auto-reload on stream completion when no navigation occurred
- Handle tool-error events in the browser client for better debugging
- Add a protocol-adherence scorer to improve agent response quality
- Upgrade input from single-line `<input>` to multi-line `<textarea>`

**Non-Goals:**
- Changing the support agent's UI (except potentially extracting shared code)
- Changing the workflow agent's controller or backend logic
- Altering the procedural instruction protocol (the 7-step flow stays)
- Changing the shared SSE infrastructure in `app/utils/agent-sse.ts`
- Adding conversation recall on frame reload (stateless per session is fine for workflow)

## Decisions

### Decision 1: Copy-and-adapt vs extract shared core

Copy the support agent's chat bubble rendering, question display, and suspension UI patterns into the workflow agent stream client, rather than extracting a shared base.

**Rationale**: The two stream clients have different enough UI targets (support agent targets a dedicated chat panel, workflow agent targets the agent-bar area within a sidebar layout) that a shared abstraction would require parameterization that obscures more than it clarifies. The support agent also uses German labels while the workflow agent uses English. Code duplication is ~300 lines; the coupling cost of a shared abstraction outweighs the savings at this scale.

**Alternative considered**: Extract a shared `BaseAgentStream` with pluggable renderers. Rejected because the rendering differences are pervasive (bubble styling, language, question placement, frame handling, PDF download) and the composability surface would be larger than the duplication.

### Decision 2: Chat container model

Convert `div#agent-bar` to a `div#chat-messages` container with the same bubble rendering pattern as the support agent's `appendUserMessage`/`appendAgentMessage` functions.

**Rationale**: The support agent's pattern is proven and handles all required features (user bubbles right-aligned, agent bubbles left-aligned, status messages italic, question options rendered inline, approval buttons with semantic colors). No new UI patterns are needed.

### Decision 3: Frame reload on complete

On the `complete` SSE event, if `didNavigate` is false, reload the active frame using the same `data-active-frame` attribute pattern as the support agent.

**Rationale**: After a workflow action (e.g., "lock user 5"), the agent returns a message but the user table in the frame still shows stale data. The support agent already implements this — it's a 5-line addition.

### Decision 4: Protocol-adherence scorer

Add a scorer that evaluates whether the agent followed the required protocol steps (ran consistency checks after action, presented actual numbers, generated report as final step).

**Rationale**: The workflow agent's instructions are 116 lines with detailed multi-step protocols. A scorer catches cases where the agent shortcuts or skips steps. Model: replicate the support agent's `completenessScorer` pattern but with workflow-specific criteria.

### Decision 5: Input field upgrade

Replace `<input type="text" id="workflow-agent-input">` with `<textarea id="workflow-agent-input">` matching the support agent's Enter-to-send, Shift+Enter-for-newline pattern.

## Risks / Trade-offs

- **Code duplication risk**: The workflow agent stream client will grow from ~440 to ~600+ lines, closely mirroring the support agent. Mitigation: if a third agent is created, extract shared SSE parsing at that point.
- **PDF download disruption**: The existing PDF download flow (rendered in agent-bar on complete) needs to be adapted to the chat bubble model. The download link should appear inside the agent's final message bubble, not as a separate bar element.
- **Scorer latency**: Adding a scorer adds agent latency. The support agent uses sampling rate 1.0; the workflow agent could start with a lower rate (e.g., 0.5) to evaluate overhead before committing to always-on.
- **Language inconsistency**: Workflow agent uses English UI labels, support agent uses German. The copied patterns must use English consistently.
