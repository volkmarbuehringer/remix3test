## Purpose

The test agent needs to explore the project directory structure — discovering file names, sizes, modification times, and relationships. This capability provides a parameterized directory listing tool that supports sorting, filtering, and recursive traversal.

## Requirements

### Requirement: List files with metadata

`listTestFiles` SHALL return file size (bytes) and last modification time (Unix ms) for each entry alongside the existing name and isDirectory fields. These fields SHALL always be present regardless of sorting options.

#### Scenario: Default call returns enriched entries

- **WHEN** agent calls `listTestFiles({ subdir: "" })` with no sort options
- **THEN** response includes `files` array where each entry has `name`, `isDirectory`, `size`, and `mtime`

### Requirement: Sort by field

`listTestFiles` SHALL accept an optional `sort` parameter with values `name`, `size`, `mtime`, or `ext`. Default SHALL be `name`.

#### Scenario: Sort by size

- **WHEN** agent calls `listTestFiles({ subdir: "", sort: "size" })`
- **THEN** files are sorted by size in descending order (largest first)

#### Scenario: Sort by mtime

- **WHEN** agent calls `listTestFiles({ subdir: "", sort: "mtime" })`
- **THEN** files are sorted by modification time in descending order (newest first)

### Requirement: Order direction

`listTestFiles` SHALL accept an optional `order` parameter with values `asc` or `desc`. Default SHALL be `desc` when sort is `size` or `mtime`, and `asc` when sort is `name` or `ext`.

#### Scenario: Ascending order

- **WHEN** agent calls `listTestFiles({ subdir: "", sort: "name", order: "desc" })`
- **THEN** files are sorted by name in descending alphabetical order

### Requirement: Result limit

`listTestFiles` SHALL accept an optional `limit` parameter (integer, max 100). When set, only the top N entries SHALL be returned.

#### Scenario: Limit results

- **WHEN** agent calls `listTestFiles({ subdir: "app", sort: "size", limit: 3 })`
- **THEN** response contains at most 3 entries

#### Scenario: Limit exceeds max

- **WHEN** agent calls `listTestFiles({ subdir: "", limit: 200 })`
- **THEN** limit SHALL be capped at 100

### Requirement: Filter by extension

`listTestFiles` SHALL accept an optional `ext` parameter to filter by file extension (e.g., `".ts"`, `".json"`). Directories and files with non-matching extensions SHALL be excluded.

#### Scenario: Filter by .ts extension

- **WHEN** agent calls `listTestFiles({ subdir: "app", ext: ".ts" })`
- **THEN** only files ending in `.ts` are returned; directories are excluded

### Requirement: Recursive traversal

`listTestFiles` SHALL accept an optional `recursive` boolean parameter. When true, the tool SHALL traverse subdirectories recursively. `.git` and `node_modules` directories SHALL always be excluded from recursion.

#### Scenario: Recursive listing

- **WHEN** agent calls `listTestFiles({ subdir: "app", recursive: true })`
- **THEN** response includes files from all subdirectories within `app/`

#### Scenario: node_modules excluded

- **WHEN** agent calls `listTestFiles({ subdir: "", recursive: true })`
- **THEN** no files from `node_modules/` appear in results

### Requirement: Path traversal protection

The existing path traversal and absolute path guards SHALL remain in effect for all new parameters.

#### Scenario: Traversal blocked

- **WHEN** agent calls `listTestFiles({ subdir: "../etc" })`
- **THEN** tool returns error `"Path traversal detected"`

### Requirement: Directory listing SHALL include formatted display data

The `listTestFiles` tool SHALL return a `display` field for each file entry containing:

- `formattedSize`: Human-readable file size (e.g., "2.3 MiB", "1.2 KiB", "340 B")
- `type`: Either `"directory"` or `"file"`
- `icon`: A Unicode icon character — `📁` for directories, `📄` for files

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

The `formattedSize` field SHALL convert raw bytes to the nearest binary unit (KiB, MiB, GiB) with one decimal place for values >= 10, and two decimal places for values < 10. Raw bytes SHALL display as `"<value> B"` with no decimal places.

#### Scenario: Byte values under 1 KiB

- **WHEN** a file is 512 bytes
- **THEN** `display.formattedSize` SHALL be `"512 B"`

#### Scenario: Values in KiB range

- **WHEN** a file is 2048 bytes (2 KiB)
- **THEN** `display.formattedSize` SHALL be `"2.00 KiB"`

#### Scenario: Values in MiB range

- **WHEN** a file is 2_500_000 bytes
- **THEN** `display.formattedSize` SHALL be `"2.4 MiB"`
