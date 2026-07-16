## ADDED Requirements

### Requirement: Toolset includes routeNavigate

The system SHALL provide a `routeNavigate` tool in addition to the existing support tools. The `routeNavigate` tool SHALL be the same tool used by the route agent, imported from `app/actions/mastra/tools/route-navigate.ts`.

#### Scenario: routeNavigate is available

- **WHEN** the support agent is instantiated
- **THEN** `routeNavigate` SHALL be available as a tool in `supportAgent.tools`
- **AND** calling `routeNavigate({ path: '/admin/users' })` SHALL return `{ type: 'route', path: '/admin/users' }`
