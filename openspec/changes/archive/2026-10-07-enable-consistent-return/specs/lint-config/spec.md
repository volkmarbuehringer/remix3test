## ADDED Requirements

### Requirement: Functions return consistently

`.oxlintrc.json` SHALL enable the explicitly-listed rule
`typescript/consistent-return`, while keeping every built-in category `"off"`,
so that a function whose code paths both return a value and fall through is
rejected.

#### Scenario: Mixed return paths are rejected

- **WHEN** a function returns a value on some paths and falls through (or uses a
  bare `return`) on others
- **THEN** `npm run lint` SHALL exit non-zero

#### Scenario: Categories stay off

- **WHEN** `.oxlintrc.json` is inspected
- **THEN** `typescript/consistent-return` SHALL be listed with a non-`"off"`
  severity
- **THEN** the built-in categories SHALL remain `"off"`
