## Purpose

Validates raw SQL query results against per-query schemas and returns wire-honest, typed rows so data-layer consumers never receive untyped or mistyped row data.

## ADDED Requirements

### Requirement: Raw query results are validated against a row schema
The data layer SHALL provide helpers that execute a raw SQL statement and validate every returned row against a caller-supplied schema before returning. Returned rows SHALL be typed from the schema's inferred output type, never as untyped records.

#### Scenario: Multi-row query
- **WHEN** a query returns multiple rows and each row matches the schema
- **THEN** the caller receives an array of typed rows

#### Scenario: Single-row query
- **WHEN** a query returns exactly one row and it matches the schema
- **THEN** the caller receives that typed row

#### Scenario: No rows returned
- **WHEN** a single-row query returns zero rows
- **THEN** the caller receives `undefined`

#### Scenario: Row violates the schema
- **WHEN** a returned row does not match the schema
- **THEN** the helper throws an error identifying the failing query, and no partially-typed rows are returned to the caller

### Requirement: Wire types follow the pg type mapping
Row schemas SHALL decode columns according to node-postgres's native return types: `int4` columns as numbers and `int8` columns as strings. Aggregate expressions over `int8` columns (`count`, `min`, `max`, `sum`, `avg`) SHALL be coerced to numbers at the decoding boundary.

#### Scenario: int4 column
- **WHEN** a query selects an `int4` column such as a serial `id`
- **THEN** the decoded row field is typed and validated as a number

#### Scenario: int8 column
- **WHEN** a query selects an `int8` column such as a unix-ms timestamp
- **THEN** the decoded row field is typed and validated as a string

#### Scenario: Aggregate over int8
- **WHEN** a query computes `count(*)` or an aggregate over an `int8` column
- **THEN** the decoded value is a number

### Requirement: Row schemas are the single source of truth for raw row shape
The data layer SHALL derive raw row types from the row schemas via type inference and SHALL NOT maintain duplicate hand-written row interfaces alongside them. Consumers of raw queries SHALL receive schema-derived row types and SHALL NOT receive untyped records.

#### Scenario: Schema defines the row type
- **WHEN** a raw query is defined with a row schema
- **THEN** the row type consumed by callers is derived from that schema

#### Scenario: No untyped rows leak
- **WHEN** a raw query result is consumed
- **THEN** the caller receives typed rows, never a raw `Record<string, unknown>`