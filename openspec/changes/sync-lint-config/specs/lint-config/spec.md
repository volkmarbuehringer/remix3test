## ADDED Requirements

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
