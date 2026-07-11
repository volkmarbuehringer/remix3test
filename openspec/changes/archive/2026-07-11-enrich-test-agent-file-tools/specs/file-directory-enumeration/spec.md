## ADDED Requirements

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
