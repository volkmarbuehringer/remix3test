## Purpose

Defines the addition of a `capabilities` column to the resources table, providing a dedicated multiline textarea in the admin panel for admins to describe what each resource can do. The column is indexed with a GIN trigram index for efficient ILIKE search by the customer agent.

## Requirements

### Requirement: Resources SHALL have a `capabilities` column

A new column `capabilities TEXT DEFAULT ''` SHALL be added to the `resources` table via a migration. The column SHALL be nullable or default to an empty string. It SHALL be stored alongside the existing `name` and `description` columns.

#### Scenario: Migration adds the column

- **WHEN** the database migration runs
- **THEN** the `resources` table has a `capabilities` column of type TEXT

#### Scenario: Existing data is preserved

- **WHEN** the migration runs on a database with existing resources
- **THEN** existing rows have `capabilities` set to the default empty string
- **AND** no existing `name` or `description` values are modified

### Requirement: Admin form SHALL render capabilities as a multiline textarea

The admin resources form SHALL render the `capabilities` field as a `<textarea>` element with minimum 4 rows. The label SHALL read "Capabilities". The textarea SHALL appear below the existing description field in both the create and edit panels.

#### Scenario: Create panel shows capabilities textarea

- **WHEN** admin opens the create resource panel
- **THEN** a "Capabilities" label with a `<textarea>` (4 rows) is rendered below the description field

#### Scenario: Edit panel shows capabilities textarea with existing value

- **WHEN** admin opens the edit panel for an existing resource
- **THEN** a "Capabilities" label with a `<textarea>` (4 rows) is rendered below the description field
- **AND** the existing `capabilities` value is pre-filled in the textarea

### Requirement: Capabilities SHALL support multiline values

The controller SHALL preserve newlines in the submitted `capabilities` value without stripping or replacing them.

#### Scenario: Multiline value preserved on create

- **WHEN** admin creates a resource with a multiline capabilities value containing newlines
- **THEN** the capabilities are stored with newlines intact

#### Scenario: Multiline value preserved on update

- **WHEN** admin updates a resource's capabilities to contain multiple lines
- **THEN** the capabilities are updated with newlines intact
- **AND** re-opening the edit panel shows the newlines in the textarea

### Requirement: Capabilities SHALL be indexed for full-text search

A GIN trigram index SHALL be added on `resources.capabilities` to enable efficient ILIKE queries. This requires enabling the `pg_trgm` extension if not already enabled.

#### Scenario: Index exists after migration

- **WHEN** the database migration runs
- **THEN** a GIN index exists on `resources.capabilities`

### Requirement: Capabilities SHALL be included in the resource schema

The existing `Resource` type or table definition in `app/data/schema.ts` SHALL include the `capabilities` field.

#### Scenario: Schema includes capabilities

- **WHEN** reading a resource from the database
- **THEN** the returned object includes a `capabilities` property
