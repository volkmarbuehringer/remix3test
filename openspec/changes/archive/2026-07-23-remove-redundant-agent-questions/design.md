## Context

The workflow agent (`app/actions/mastra/agents/workflow-agent.ts`) manages admin user operations (lock, unlock, cancel). Its current instruction set includes redundant confirmation steps that slow down operators:

1. Step 2 of the user flow asks "What would you like to do?" even when the admin already stated their intent
2. Each protocol has an ask_user "Confirm?" step that duplicates the user's original statement
3. End-of-flow lacks strong anti-loop language, so the LLM defaults to "Anything else?"
4. targetUserId must be carried across multiple LLM turns without tool-level persistence

The support agent (`support-agent.ts`) demonstrates the intended pattern: no chat confirmations, trust the system approval button.

## Goals / Non-Goals

**Goals:**
- Remove redundant ask_user calls for intent re-statement and confirmation in lock/cancel/unlock flows
- Preserve the one real decision point: whether to delete pending appointments during cancellation
- Eliminate end-of-flow "Anything else?" questions
- Ensure targetUserId is reliably passed between tool calls without admin re-prompting

**Non-Goals:**
- Not changing the customer agent's post-booking question (separate concern)
- Not removing system-level requireApproval buttons (they stay as the security gate)
- Not changing tool implementation logic — instruction changes only (unless userId fragility requires it)

## Decisions

### Decision 1: Remove Step 2 (ask_user for action intent)

**What**: Remove the instruction at lines 424-427 that tells the agent to call ask_user with the action as an option when the admin already stated it.

**Rationale**: The admin saying "Lock user 5" IS the intent. Requiring a second statement ("What would you like to do? [Lock user 5]") adds friction with zero security value. The system `requireApproval` button on the tool handles authorization.

**Alternative considered**: Keep Step 2 but make it conditional on ambiguous intent only. Rejected because the instruction already has this carveout ("If the admin just asked a question...") but the LLM still over-applies the ask_user pattern.

### Decision 2: Remove ask_user "Confirm?" from all three protocols

**What**: Remove Step 3 from cancel protocol (line 475: "Confirm cancellation?"), Step 3 from lock protocol (line 486: "Confirm lock?"), Step 3 from unlock protocol (line 495: "Confirm unlock?").

**Rationale**: Same as Decision 1 — the user already confirmed by typing the command. The `requireApproval` flag on the tool provides the system-level confirmation.

### Decision 3: Stronger anti-loop language at end of flow

**What**: Replace the weak "Do NOT loop — the admin will ask something new" (line 433) with explicit examples of forbidden closing questions.

**Rationale**: LLMs default to helpful closing questions ("Is there anything else?"). A bare negative instruction is the weakest form of behavioral control. Explicit examples of what NOT to say are more effective.

### Decision 4: Address targetUserId fragility

**What**: Ensure the tool's description and the instructions emphasize carrying targetUserId forward. Optionally cache it in async working memory (like admin-context.ts) so the confirmed=true call doesn't require the param.

**Rationale**: The LLM can lose targetUserId across multiple tool turns (lookup → navigate → check → ask_user → execute). If it re-asks the admin, that's the most frustrating redundancy — the user already provided the ID.

**Alternative considered**: Redesign the tool to internally store targetUserId between confirmed=false and confirmed=true calls. This is more robust but requires tool implementation changes beyond instruction edits.

## Risks / Trade-offs

- **[Risk] LLM might skip ask_user for the appointment deletion question too** → Mitigation: Instructions must clearly distinguish the one question that SHOULD be asked (delete appointments?) from the ones that should NOT (confirm action?)
- **[Risk] Removing confirmations increases error rate from LLM acting on misunderstood intent** → Mitigation: The system `requireApproval` button is still present. If the LLM locks the wrong user, the admin can decline the approval button.
- **[Risk] LLM still asks "Anything else?" despite stronger instruction** → Mitigation: If persistent, add a `scorer` that penalizes closing questions, similar to the existing `protocolAdherenceScorer`.
