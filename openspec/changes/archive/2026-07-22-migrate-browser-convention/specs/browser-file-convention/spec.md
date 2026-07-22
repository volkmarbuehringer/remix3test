## ADDED Requirements

### Requirement: Browser entry file naming

Client-side interactive components using `clientEntry()` SHALL use the `.browser.tsx` file extension.

#### Scenario: New clientEntry component

- **WHEN** a developer creates a new `clientEntry` component
- **THEN** the file SHALL be named `*.browser.tsx` (e.g., `counter.browser.tsx`)
- **AND** the file MAY be placed in any application directory

#### Scenario: Existing clientEntry without .browser suffix

- **WHEN** a file using `clientEntry()` lacks the `.browser.tsx` suffix
- **THEN** the component SHALL NOT be compiled for client delivery
- **AND** the render middleware SHALL throw at dev time via `resolveClientEntry`

### Requirement: Server-only file exclusion

Files using the `.server.tsx` suffix SHALL be excluded from client compilation.

#### Scenario: Server-only file

- **WHEN** a file has the `.server.tsx` suffix
- **THEN** the asset server SHALL deny it from client delivery
- **AND** it SHALL still be available for server-side imports

### Requirement: Asset server allowFiles precision

The `createAssetServer` config SHALL use `**/*.browser.*` as the primary allow pattern, replacing broad directory-based patterns.

#### Scenario: New file in app/ui without .browser suffix

- **WHEN** a new `.tsx` file is added to `app/ui/`
- **THEN** it SHALL NOT be compiled for client delivery unless it has the `.browser.tsx` suffix
- **AND** it SHALL still be available for server-side imports

### Requirement: Client boot script

The client boot script (`app/assets/entry.tsx`) SHALL remain accessible without a `.browser.` suffix.

#### Scenario: entry.tsx delivery

- **WHEN** the client boot script at `app/assets/entry.tsx` is requested
- **THEN** it SHALL be compiled and served to the browser
- **AND** it does not require a `.browser.` suffix
