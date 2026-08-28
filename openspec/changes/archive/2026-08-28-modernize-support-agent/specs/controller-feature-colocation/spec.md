## MODIFIED Requirements

### Requirement: `remix doctor` action-layout warnings are non-gating

The consolidation convention produces `remix doctor` "missing action controller" / "does not match any route map" warnings, because the doctor expects one controller per route *node* at a kebab path, which is structurally incompatible with one controller per route *group*. These warnings are expected and SHALL NOT block CI or PR merge.

#### Scenario: Known doctor noise after consolidation

- **WHEN** the consolidation convention is in place
- **THEN** `remix doctor` action-layout warnings SHALL be treated as known/expected
- **AND** they SHALL not be used as a gate in CI or as a merge requirement

#### Scenario: Future doctor config adopted if available

- **WHEN** a future `remix` version ships configuration to scope or disable the action-layout doctor check
- **THEN** that configuration SHALL be adopted to reduce the known noise

#### Scenario: `mastra/` is an intentional exception

- **WHEN** the `supportAgent` handler is consolidated
- **THEN** its implementation SHALL live in a colocated top-level `app/actions/support-agent/controller.tsx` (re-exported by `admin/controller.tsx` as `supportAgent`), matching the structure used by `workflow-agent` and `agent-events`, and SHALL NOT be re-exported from `app/actions/mastra/controller.tsx`
- **AND** the `mastra/` directory (agents, tools, workflows, scorers, notifications, `index.ts`, `shared-agent.ts`, `storage.ts`, `workflow-executor.ts`) SHALL NOT be merged, because it is the Mastra agent subsystem, not a route-controller group
