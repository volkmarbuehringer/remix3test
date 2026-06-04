## ADDED Requirements

### Requirement: Controllers are colocated in feature directories

Each controller module SHALL reside in a directory named after the feature it implements, with the canonical entry point named `controller.tsx`. Associated test files and page components SHALL be placed in the same directory.

#### Scenario: Flat controller becomes feature directory

- **WHEN** a controller exists as a flat file `app/actions/<name>-controller.tsx`
- **THEN** the system MUST have a directory `app/actions/<name>/` containing `controller.tsx` with the original content and updated relative imports

#### Scenario: Tests move with the controller

- **WHEN** a controller is moved into a feature directory
- **THEN** all associated test files (`*.test.ts`, `*.test.tsx`) SHALL be moved into the same feature directory

#### Scenario: Page components move with the controller

- **WHEN** a flat page component exists alongside a controller (e.g., `lists-show-page.tsx`)
- **THEN** the page component SHALL be moved into the controller's feature directory

#### Scenario: Router imports remain valid after migration

- **WHEN** all controllers have been migrated to feature directories
- **THEN** `app/router.ts` SHALL import each controller from its new feature directory path
- **AND** all route mappings SHALL produce identical HTTP responses as before the migration

#### Scenario: Existing feature directories are preserved

- **WHEN** the migration completes
- **THEN** `app/actions/client/` and `app/actions/nutzer/` SHALL remain unchanged

#### Scenario: File history is preserved

- **WHEN** files are moved into feature directories
- **THEN** all moves SHALL use `git mv` to preserve version control history
