## ADDED Requirements

### Requirement: Curated high-signal rules are explicitly enabled

`.oxlintrc.json` SHALL enable the explicitly-listed rules
`unicorn/no-array-sort`, `unicorn/no-array-reverse`,
`eslint/preserve-caught-error`, and `eslint/no-unsafe-optional-chaining`, while
keeping every built-in category `"off"`.

#### Scenario: In-place array mutation is rejected

- **WHEN** a source file calls `Array#sort()` or `Array#reverse()` instead of
  `Array#toSorted()` or `Array#toReversed()`
- **THEN** `npm run lint` SHALL exit non-zero

#### Scenario: A dropped error cause is rejected

- **WHEN** a caught error is re-thrown in a new `Error` without a `cause`
- **THEN** `npm run lint` SHALL exit non-zero

#### Scenario: The rules are explicit, categories stay off

- **WHEN** `.oxlintrc.json` is inspected
- **THEN** the four rules SHALL be listed with a non-`"off"` severity
- **THEN** the built-in categories SHALL remain `"off"`
