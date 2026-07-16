## ADDED Requirements

### Requirement: Directory listing SHALL include formatted display data

The `listTestFiles` tool SHALL return a `display` field for each file entry containing:

- `formattedSize`: Human-readable file size (e.g., "2.3 MB", "1.2 KB", "340 B")
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
