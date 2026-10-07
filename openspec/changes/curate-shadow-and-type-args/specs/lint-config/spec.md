## ADDED Requirements

### Requirement: Shadowing and redundant type arguments are rejected

`.oxlintrc.json` SHALL enable the explicitly-listed rules `eslint/no-shadow`
and `typescript/no-unnecessary-type-arguments`, while keeping every built-in
category `"off"`.

#### Scenario: A shadowed binding is rejected

- **WHEN** a variable or parameter shadows a binding from an upper scope
- **THEN** `npm run lint` SHALL exit non-zero

#### Scenario: A redundant default type argument is rejected

- **WHEN** a type argument is written that equals the type parameter's default
- **THEN** `npm run lint` SHALL exit non-zero

#### Scenario: Categories stay off

- **WHEN** `.oxlintrc.json` is inspected
- **THEN** both rules SHALL be listed with a non-`"off"` severity
- **THEN** the built-in categories SHALL remain `"off"`
