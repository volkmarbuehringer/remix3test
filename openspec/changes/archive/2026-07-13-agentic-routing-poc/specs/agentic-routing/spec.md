## ADDED Requirements

### Requirement: Agent can navigate to a route

The test agent SHALL have a `navigate(path, query?)` tool that accepts a route path and optional query parameters. When called, the tool SHALL return `{ type: "route", path: "<full-path>" }`. The client-side SSE handler SHALL detect this result and navigate the frame to the specified path.

#### Scenario: Agent navigates to lists overview

- **WHEN** user types "show me the lists" in the input bar
- **AND** the agent calls `navigate({ path: "/lists" })`
- **THEN** the frame SHALL load the `/lists` page with the lists sidebar and empty new-list form

#### Scenario: Agent navigates to a specific list

- **WHEN** user types "show me list 5"
- **AND** the agent calls `navigate({ path: "/lists", query: { load: "5" } })`
- **THEN** the frame SHALL load the `/lists?load=5` page with list 5 selected and its items displayed

### Requirement: Persistent input bar

The `/route-agent` page SHALL render a text input bar fixed at the bottom of the viewport, below the content frame. The input bar SHALL send messages to the test agent via POST to `/testagent`. The input bar SHALL be visible at all times, regardless of what the frame displays.

#### Scenario: Input bar is always visible

- **WHEN** the user navigates to `/route-agent`
- **THEN** the input bar SHALL be rendered at the bottom of the viewport
- **AND** the content frame SHALL be rendered above the input bar
- **AND** scrolling the frame SHALL NOT affect the input bar position

### Requirement: Frame navigates on route event

The client-side SSE handler SHALL listen for `tool-result` events. When a `tool-result` event contains `result.type === "route"`, it SHALL navigate the frame to `result.path` using `handle.frames.get('lists-content')`.

#### Scenario: Frame is named lists-content

- **WHEN** the `/route-agent` page renders
- **THEN** the content frame SHALL have the name `lists-content`
- **SO THAT** `X-Remix-Target: lists-content` is sent on frame requests, matching the lists route's fragment rendering

#### Scenario: Frame reloads on route event

- **WHEN** the SSE handler receives a `tool-result` with `result.type === "route"` and `result.path === "/lists?load=5"`
- **THEN** it SHALL set `handle.frames.get('lists-content').src = "/lists?load=5"`
- **AND** it SHALL call `.reload()` on that frame
- **AND** the frame SHALL display the lists page with list ID 5 loaded
