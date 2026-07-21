## Context

The workflow agent (`app/actions/mastra/agents/workflow-agent.ts`) uses a single unified flow for ALL user questions: navigate to `/admin/users` → ask_user → execute action → consistency checks. This works for user management but provides no path for appointment-related queries. The agent says "I have no tools for that" when asked about appointments.

The infrastructure to support appointment navigation already exists:
- `navigate` tool accepts any path and query params
- `/verwaltung/appointments` supports `filter` (text ILIKE search), `period` (today, this_week, etc.), `status` (pending/expired), `offset` (pagination)
- `getTarget('/verwaltung/...')` in both controllers already maps to the `admin-content` frame
- The SSE pipeline in `agent-sse.ts` already handles `navigate` events with query params

No new tools, routes, or controller changes are needed. The change is confined to the agent instructions.

## Goals / Non-Goals

**Goals:**
- Workflow agent detects appointment-related questions and navigates to `/verwaltung/appointments` with appropriate query params
- Natural language date/status references are mapped to the page's supported params (`period`, `status`, `filter`)
- Existing user management flow stays completely unchanged
- Appointment navigation is a terminal action — agent waits for next question after navigating

**Non-Goals:**
- No new tools or tool modifications
- No changes to the appointments controller or page
- No changes to the support agent — it remains the "ask me anything" entry point
- No consistency checks for appointment queries (those are user-management-specific)

## Decisions

### Decision 1: Agent instructions only, no code

The change requires only editing the agent's `instructions` string in `app/actions/mastra/agents/workflow-agent.ts`. The model already has the `navigate` tool and the `routeNavigate` tool definition accepts query params. The model just needs to be told when and how to use it for appointments.

**Alternative considered:** Adding a dedicated `searchAppointments` tool that wraps `listAppointments` from the data layer. This would give the agent structured data to answer inline ("User 5 has 3 appointments this week"). Rejected because:
- The user explicitly wants navigation to the page ("open /verwaltung/appointments with prefilled filter")
- The page has richer display (sortable grid, edit/delete actions, create form) than a text response
- A dedicated tool would duplicate the page's filtering logic

### Decision 2: Branch in the unified flow, not a separate mode

The appointment flow branches at the start of the unified flow instruction: if appointment-related → navigate to appointments page with params → done. If user-related → existing flow. This keeps the agent instructions coherent — one entry point that branches naturally based on query content, rather than two separate mode instructions.

### Decision 3: The LLM handles intent classification

The spec lists appointment-related keywords ("appointment", "Termin", etc.), but the actual classification is done by the model based on the instruction text. No regex or intent-classification code is added.

**Risk:** The model may misclassify ambiguous queries. For example, "show appointments for disabled users" could be about either users or appointments. Mitigation: the instruction tells the agent to follow the user flow when user management is the primary topic, and the appointment flow when appointments are the primary topic.

## Risks / Trade-offs

- [Low] **Ambiguous queries**: "show appointments for locked users" could match both flows. The instruction should prioritize user management when both are relevant, since the user consistency checks cover appointment overlap. → Agent instruction clarifies: when the primary topic is a specific user's account status, use the user flow.
- [Low] **Model quality**: The appointment flow relies on the model correctly mapping "this week" → `period: "this_week"`. If the model invents an unsupported param name, the page ignores it. No crash risk, just a silent no-op. → Mitigated by providing an explicit mapping table in the instructions.
- [None] **Frame target**: `/verwaltung/` is already mapped to `admin-content` in `getTarget()`, so navigations will render in the correct frame.
