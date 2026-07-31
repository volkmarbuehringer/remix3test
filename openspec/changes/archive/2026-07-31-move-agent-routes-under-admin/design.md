# Design: move-agent-routes-under-admin

## Route tree nesting

Both agent route trees move under the existing `admin` tree:

```
routes.admin = route('admin', {
  ...
  workflowAgent: route('workflow-agent', {
    index: get('/'),
    panel: get('/panel'),
    action: post('/'),
    resume: post('/resume'),
    stream: get('/stream'),
  }),
  agentEvents: route('workflowagent2', {
    index: get('/'),
    panel: get('/panel'),
    action: post('/'),
    resume: post('/resume'),
  }),
})
```

Resulting URLs:

| Before | After |
| --- | --- |
| `/workflow-agent` | `/admin/workflow-agent` |
| `/workflow-agent/panel` | `/admin/workflow-agent/panel` |
| `/workflowagent2` | `/admin/workflowagent2` |
| `/workflowagent2/panel` | `/admin/workflowagent2/panel` |

Wiring follows the proven `client`/`nutzer` pattern: `routes.admin` stays mapped to `admin.adminController`, and the narrower `router.map(routes.admin.workflowAgent, workflowAgent)` / `router.map(routes.admin.agentEvents, agentEvents)` calls override those subtrees. `requireAdmin()` middleware stays on both controllers.

## Rendering the sidebar

The controllers' `index` actions switch from `context.render(<Layout>…)` to a single `renderAdminPage(context.render, activeItem, <AgentPage/>)` call. `renderAdminPage` → `ShellOrFragment` already handles both cases:

- Frame request (`X-Remix-Target: admin-content`) → sidebar shell + page content
- Direct GET → `Layout > Frame(name=admin-content)` which re-requests the URL with the target header, producing the sidebar
- Non-GET → `Layout > sidebar shell` (not used by these GET-only index actions)

No manual two-branch render is needed (unlike `test-agent`, which predates this and kept one).

## Nested frame naming — the key risk

Both agent pages embed an inner panel frame:

```tsx
<Frame name="admin-content" src={routes.xxx.panel.href()} ... />
```

The Remix runtime resolves `getNamedFrame(name)` against a **per-document** frame-name map (`namedFrames` in `ui/runtime/run.ts`), falling back to the current document's top frame. After nesting, the agent page document (the content of the top-level `admin-content` frame) would contain **both** the sidebar shell and an inner frame named `admin-content`:

```
top document                admin-content frame document
┌─────────────────┐         ┌─────────────────────────────┐
│ Layout          │         │ ┌─────────┐ ┌────────────┐  │
│ ┌────────────┐  │  load   │ │ Sidebar │ │ AgentPage  │  │
│ │ Frame      │  │────────▶│ │         │ │ ┌────────┐ │  │
│ │ admin-     │  │         │ │         │ │ │Frame   │ │  │
│ │ content    │  │         │ │         │ │ │admin-  │ │  │
│ └────────────┘  │         │ └─────────┘ │ │content │ │  │
└─────────────────┘         │             │ └────────┘ │  │
                            │             └────────────┘  │
                            └─────────────────────────────┘
```

With the frame still named `admin-content`, a sidebar `NavLink` click from inside that document would resolve `getNamedFrame('admin-content')` to the **inner panel frame**, so Dashboard/Chatlog/etc. would load into the small panel instead of navigating the whole admin page.

### Decision: rename the inner panel frames

Each panel frame gets a unique name, and the SSE navigate events that mean "load into this panel" are updated to match:

| Page | Panel frame name | `data-active-frame` | SSE navigate target |
| --- | --- | --- | --- |
| Workflow-Agent | `workflow-agent-panel` | `workflow-agent-panel` | `workflow-agent-panel` |
| Agent-Events | `agent-events-panel` | `agent-events-panel` | `agent-events-panel` |

Effect after the move:

- Sidebar `NavLink` clicks: `getNamedFrame('admin-content')` no longer matches a frame in the agent page document → falls back to the document's top frame (the `admin-content` frame itself) → whole-page navigation. Correct.
- SSE `navigate` events (e.g. "user not found" → load `/admin/users` into the panel): `handle.frames.get('agent-events-panel')` resolves the panel frame in the same document. Preserves today's behavior exactly.

Controller emit sites to update:

- `agent-events/controller.tsx`: `entities.notfound` navigate event, generic `navigate` passthrough
- `workflow-agent/controller.tsx`: navigate events at the user-not-found and locked/unlocked intents, plus the `getTarget()` prefix map

### Panel frame targets are content-only

A `<Frame>` fetches its `src` with `X-Remix-Target: <frameName>` (`app/middleware/render.tsx`). Loading an admin route into the panel with a plain frame target would render the full admin fragment — including the sidebar — duplicating the sidebar the agent page already shows (both agent pages render via `renderAdminPage`, so the sidebar is already on the left).

Fix: register the panel frame names as **content-only** targets on the sidebar layout. `createSidebarLayout` gained a `contentOnlyTargets` set: when the incoming `X-Remix-Target` matches one, `ShellOrFragment` returns just the page content (`children`) instead of the sidebar shell:

```tsx
createSidebarLayout<AdminNavItem>({
  frameTarget: frames.adminContent,
  acceptFrameTargets: [frames.listsContent],
  contentOnlyTargets: [frames.agentEventsPanel, frames.workflowAgentPanel],
  ...
})
```

With that, loading `/admin/users` into the panel renders only the users grid — no duplicate sidebar, no public `MainNav`, no nested `rmx-frame`. The panel stays content-only, so the "navigate then continue streaming" flows (e.g. delete-resource navigates the panel to `/verwaltung/appointments`, then the workflow still streams into the same connection and the panel reloads on `workflow-finish`) keep working.

The frame names are centralized in `frames` (`app/routes.ts`) so the page `<Frame name>`, `data-active-frame`, SSE navigate targets, and the target lists cannot drift apart.

Client stream defaults to update:

- Both streams read the active frame from `data-active-frame` and default navigate targets to `admin-content` — update the defaults to the panel names.

## URL references outside the route tree

- `app/assets/streams/*.browser.tsx` hardcode the SSE POST targets (`'/workflow-agent'`, `'/workflow-agent/resume'`, `'/workflowagent2'`, `'/workflowagent2/resume'`) → `/admin/...` paths
- `app/middleware/skip-csrf.ts` exemptions for the POST endpoints → `/admin/workflow-agent(/*)`, `/admin/workflowagent2(/*)`
- `app/route-labels.ts` href keys → `routes.admin.workflowAgent.index.href()`, `routes.admin.agentEvents.index.href()`
- `workflow-agent/controller.tsx` `getTarget()` prefix list row `'/workflow-agent'` → `'/admin/workflow-agent'`
- Test URL constants in both controller test files

## Panel actions unchanged

The `panel` actions keep returning bare fragments — they are frame endpoints and don't need shell handling. Their paths move with the route tree automatically.
