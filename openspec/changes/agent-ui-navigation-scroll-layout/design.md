## Context

The route-agent at `/route-agent` is a fully functional agent that navigates the admin lists frame. It's wired in `app/routes.ts` and `app/router.ts` but has no sidebar entry. Its current UI uses a thin status bar (`#agent-bar`) for output instead of a scrollable message history.

The test-agent and support-agent both use a scrollable timeline pattern with message bubbles, tool cards, and auto-scroll. The route-agent should follow the same pattern.

## Goals / Non-Goals

**Goals:**

- Route-Agent visible in the admin sidebar (Daten group, after Test-Agent)
- Route-agent UI has a scrollable message area (matching test-agent pattern)
- Page height fills available space, not viewport, so input is always visible
- Existing streaming/approval/question functionality preserved

**Non-Goals:**

- No changes to routing or agent logic
- No changes to the test-agent or support-agent
- No changes to the route-agent controller's stream/approve/decline/answer actions

## Decisions

### Decision 1: Admin sidebar entry

**Chosen:** Add `{ id: 'routeagent', label: 'Route-Agent', route: routes.routeAgent.index }` to the Daten group in `admin-layout.tsx`, after the existing Test-Agent entry. Add `'routeagent'` to the `AdminNavItem` union type. Add a nav icon (reuse the test-agent arrow icon or a compass SVG).

**Rationale:** Consistent with how all other admin tools are added to the sidebar.

### Decision 2: Route-agent page inside admin layout

**Chosen:** Make the route-agent controller follow the same dual-rendering pattern as test-agent and mastra-chat. Frame requests render via `renderAdminPage()`, direct requests render `Layout > AdminLayout > RouteAgentPage`.

The current controller always renders `<Layout><RouteAgentPage /></Layout>` — this needs frame detection.

**Rationale:** Without this, clicking the route-agent sidebar link opens outside the admin content frame, breaking the sidebar navigation pattern.

### Decision 3: Scrollable message area

**Chosen:** Replace the `#agent-bar` with a `#route-agent-messages` div styled exactly like `#test-timeline` (`flex: 1, minHeight: 0, overflowY: auto`). The route-agent-stream asset creates message bubbles (user + assistant) and tool cards in this container instead of setting `bar.textContent`.

**Rationale:** The test-agent already has this exact pattern working. Reusing the same approach ensures consistency and predictable behavior.

### Decision 4: Page height

**Chosen:** Change `pageStyle` from `height: 100vh` to `flex: 1, minHeight: 0` (or remove height constraint). The existing container structure uses `display: flex, flexDirection: column` which already fills available space.

**Rationale:** `100vh` forces the page to viewport height, which overflows the admin content area. Letting the flex parent handle sizing keeps the input bar pinned to the bottom of the available space.

## Risks / Trade-offs

- **No existing tests for route-agent UI** — safe to refactor layout
- **Route-agent uses testAgent agent** — the agent ID is `testAgent` which is fine, it's just a different UI frontend
- **`renderAdminPage` imports needed** — the route-agent controller needs to import `renderAdminPage` and `AdminLayout` from `admin-layout.tsx`, plus the `frames` constant from `routes.ts`
