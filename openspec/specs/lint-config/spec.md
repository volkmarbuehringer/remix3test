# Lint Configuration

## Purpose

Define and enforce the project's linting configuration standards, ensuring consistent code quality and predictable build outcomes.

## Requirements

### Requirement: Lint warnings fail the build

The `lint` and `lint:fix` scripts SHALL use `--max-warnings=0` so any lint warning exits with a non-zero status.

#### Scenario: Lint command fails on warning

- **WHEN** `npm run lint` is run and the codebase has a lint warning
- **THEN** the exit code SHALL be non-zero

### Requirement: Explicit oxlint category rules

`.oxlintrc.json` SHALL explicitly set all built-in rule categories (correctness, nursery, pedantic, perf, restriction, style, suspicious) to `"off"`.

#### Scenario: No implicit category rules

- **WHEN** oxlint runs
- **THEN** only explicitly enabled rules in `.oxlintrc.json` SHALL be checked
- **THEN** no rules from default categories (correctness, suspicious, style, etc.) SHALL be active unless explicitly listed

### Requirement: Stale ignorePatterns removed

`.oxlintrc.json` SHALL only contain `ignorePatterns` that match actual paths in this repository.

#### Scenario: No remix-specific ignores

- **WHEN** `.oxlintrc.json` is inspected
- **THEN** it SHALL NOT reference paths like `demos/bookstore`, `demos/sse`, `packages/multipart-parser` that don't exist in this app

### Requirement: Type-aware promise handling is enforced

`.oxlintrc.json` SHALL enable the type-aware rule
`typescript/no-floating-promises` as an explicitly-listed rule, so that every
expression statement producing a thenable is deliberately handled: awaited,
chained with a rejection handler, or explicitly ignored with the `void`
operator.

#### Scenario: A floating promise fails the build

- **WHEN** a source file contains an expression statement whose value is a
  `Promise` that is neither awaited nor explicitly ignored
- **THEN** `npm run lint` SHALL exit non-zero

#### Scenario: The rule is explicit, categories stay off

- **WHEN** `.oxlintrc.json` is inspected
- **THEN** `typescript/no-floating-promises` SHALL be listed with a non-`"off"`
  severity
- **THEN** the built-in categories SHALL remain `"off"`

#### Scenario: Type-aware rule runs without extra flags

- **WHEN** `npm run lint` runs
- **THEN** the type-aware rule SHALL be evaluated using the configured
  `options.typeAware: true` setting
