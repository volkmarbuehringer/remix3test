## ADDED Requirements

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
