## REMOVED Requirements

### Requirement: List files with metadata

**Reason**: The `listTestFiles` tool and the test agent that used it are retired.

**Migration**: No replacement — directory enumeration through an agent interface is removed.

#### Scenario: Default call returns enriched entries

- **WHEN** agent calls `listTestFiles({ subdir: "" })` with no sort options
- **THEN** response includes `files` array where each entry has `name`, `isDirectory`, `size`, and `mtime`

### Requirement: Sort by field

**Reason**: The `listTestFiles` tool is retired with the test agent.

**Migration**: No replacement.

#### Scenario: Sort by size

- **WHEN** agent calls `listTestFiles({ subdir: "", sort: "size" })`
- **THEN** files are sorted by size in descending order (largest first)

#### Scenario: Sort by mtime

- **WHEN** agent calls `listTestFiles({ subdir: "", sort: "mtime" })`
- **THEN** files are sorted by modification time in descending order (newest first)

### Requirement: Order direction

**Reason**: The `listTestFiles` tool is retired with the test agent.

**Migration**: No replacement.

#### Scenario: Ascending order

- **WHEN** agent calls `listTestFiles({ subdir: "", sort: "name", order: "desc" })`
- **THEN** files are sorted by name in descending alphabetical order

### Requirement: Result limit

**Reason**: The `listTestFiles` tool is retired with the test agent.

**Migration**: No replacement.

#### Scenario: Limit results

- **WHEN** agent calls `listTestFiles({ subdir: "app", sort: "size", limit: 3 })`
- **THEN** response contains at most 3 entries

#### Scenario: Limit exceeds max

- **WHEN** agent calls `listTestFiles({ subdir: "", limit: 200 })`
- **THEN** limit SHALL be capped at 100

### Requirement: Filter by extension

**Reason**: The `listTestFiles` tool is retired with the test agent.

**Migration**: No replacement.

#### Scenario: Filter by .ts extension

- **WHEN** agent calls `listTestFiles({ subdir: "app", ext: ".ts" })`
- **THEN** only files ending in `.ts` are returned; directories are excluded

### Requirement: Recursive traversal

**Reason**: The `listTestFiles` tool is retired with the test agent.

**Migration**: No replacement.

#### Scenario: Recursive listing

- **WHEN** agent calls `listTestFiles({ subdir: "app", recursive: true })`
- **THEN** response includes files from all subdirectories within `app/`

#### Scenario: node_modules excluded

- **WHEN** agent calls `listTestFiles({ subdir: "", recursive: true })`
- **THEN** no files from `node_modules/` appear in results

### Requirement: Path traversal protection

**Reason**: The `listTestFiles` tool is retired with the test agent.

**Migration**: No replacement.

#### Scenario: Traversal blocked

- **WHEN** agent calls `listTestFiles({ subdir: "../etc" })`
- **THEN** tool returns error `"Path traversal detected"`

### Requirement: Directory listing SHALL include formatted display data

**Reason**: The `listTestFiles` tool is retired with the test agent.

**Migration**: No replacement.

#### Scenario: File entries include formatted display data

- **WHEN** the agent calls `listTestFiles({ subdir: "app" })`
- **THEN** each entry in the `files` array SHALL include a `display` object with `formattedSize`, `type`, and `icon`

#### Scenario: Directory display properties

- **WHEN** an entry is a directory
- **THEN** `display.type` SHALL be `"directory"`
- **AND** `display.icon` SHALL be `"📁"`
- **AND** `display.formattedSize` SHALL be the byte size in human-readable format

#### Scenario: File display properties

- **WHEN** an entry is a file
- **THEN** `display.type` SHALL be `"file"`
- **AND** `display.icon` SHALL be `"📄"`
- **AND** `display.formattedSize` SHALL be the byte size in human-readable format

### Requirement: Human-readable size formatting SHALL use binary units

**Reason**: The `listTestFiles` tool is retired with the test agent.

**Migration**: No replacement.

#### Scenario: Byte values under 1 KiB

- **WHEN** a file is 512 bytes
- **THEN** `display.formattedSize` SHALL be `"512 B"`

#### Scenario: Values in KiB range

- **WHEN** a file is 2048 bytes (2 KiB)
- **THEN** `display.formattedSize` SHALL be `"2.00 KiB"`

#### Scenario: Values in MiB range

- **WHEN** a file is 2_500_000 bytes
- **THEN** `display.formattedSize` SHALL be `"2.4 MiB"`