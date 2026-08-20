# Controller Feature Colocation

## MODIFIED Requirements

### Requirement: Controllers are colocated per route group

Each route group (e.g. `auth`, `admin`, `verwaltung`, `api`, `webhook`) SHALL have exactly one `controller.tsx` in a directory named after the group. That file SHALL export every handler for the group as a named export (no default export). Associated page components SHALL be co-located in `pages.tsx` and tests in the same directory. Route-owned browser source SHALL be co-located in a `public/` subdirectory of the group directory.

#### Scenario: Group controllers absorb sub-routes

- **WHEN** a route group has sub-routes (e.g. `routes.admin.nutzer`, `routes.verwaltung.offerings`)
- **THEN** all of those sub-route handlers SHALL be reachable as named exports through the group's single `app/actions/<group>/controller.tsx` entry point (either inlined, or re-exported from co-located subgroup modules)
- **AND** `app/router.ts` SHALL import the entire group from that single `controller.tsx` rather than from per-subroute paths
- **AND** subgroup implementation modules MAY remain on disk (e.g. `app/actions/nutzer/controller.tsx`) because `remix doctor` action-layout warnings are non-gating (see below)

#### Scenario: Flat controller becomes feature directory

- **WHEN** a controller exists as a flat file `app/actions/<name>-controller.tsx`
- **THEN** it SHALL be merged into the owning group's `app/actions/<name>/controller.tsx` with the original content and updated relative imports

#### Scenario: Tests move with the controller

- **WHEN** a controller is merged into a group controller
- **THEN** all associated test files (`*.test.ts`, `*.test.tsx`) SHALL be moved into the group directory

#### Scenario: Page components move with the controller

- **WHEN** page components exist alongside a controller
- **THEN** they SHALL be moved into the group's `pages.tsx`

#### Scenario: Route-owned browser source moves with the group

- **WHEN** a route group owns browser source
- **THEN** it SHALL be moved into the group's `public/` subdirectory
- **AND** the owning server module SHALL import it via a relative `./public/<name>.tsx` path

#### Scenario: Router imports remain valid after migration

- **WHEN** all controllers have been migrated to group controllers
- **THEN** `app/router.ts` SHALL import each group's handlers from its single group `controller.tsx`
- **AND** all route mappings SHALL produce identical HTTP responses as before the migration

#### Scenario: File history is preserved

- **WHEN** files are merged into group controllers
- **THEN** all moves SHALL use `git mv` to preserve version control history

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
- **THEN** its implementation SHALL remain in `app/actions/mastra/controller.tsx` (re-exported by `admin/controller.tsx` as `supportAgent`)
- **AND** the `mastra/` directory (agents, tools, workflows, scorers, notifications, `index.ts`, `shared-agent.ts`, `storage.ts`, `workflow-executor.ts`) SHALL NOT be merged, because it is the Mastra agent subsystem, not a route-controller group
