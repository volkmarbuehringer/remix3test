## ADDED Requirements

### Requirement: Enable erasableSyntaxOnly in tsconfig

The project `tsconfig.json` SHALL include `"erasableSyntaxOnly": true` in its `compilerOptions` section.

#### Scenario: Compiler option is present
- **WHEN** the project `tsconfig.json` is parsed
- **THEN** `compilerOptions.erasableSyntaxOnly` SHALL equal `true`

#### Scenario: TypeScript compilation passes
- **WHEN** `tsc --noEmit` is run
- **THEN** compilation SHALL succeed with no errors related to `erasableSyntaxOnly`

### Requirement: Existing codebase remains valid

All existing source code SHALL remain valid under the `erasableSyntaxOnly` constraint without modifications.

#### Scenario: No enums or parameter properties in use
- **WHEN** the codebase is searched for `enum`, `namespace`, or parameter property syntax (`constructor(public|private|protected)`)
- **THEN** no instances SHALL be found

#### Scenario: Type check passes without code changes
- **WHEN** `pnpm typecheck` is run before and after the change
- **THEN** the output SHALL be identical (same errors, if any, or same success)
