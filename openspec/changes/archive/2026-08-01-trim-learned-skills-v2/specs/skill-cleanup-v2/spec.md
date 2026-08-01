# Skill Cleanup v2 — Capability Spec

## MODIFIED Requirements

### Requirement: Obsolete restatement skills are removed

The `remix-cookies`, `remix-render-middleware`, `remix-response-helpers`, and `remix-demos` skills SHALL NOT exist in `.opencode/skills/learned/`. Their coverage SHALL be provided by the corresponding package READMEs and the vendor `remix` skill.

#### Scenario: Skill directories no longer present

- **WHEN** the cleanup is applied
- **THEN** `.opencode/skills/learned/remix-cookies/`, `remix-render-middleware/`, `remix-response-helpers/`, and `remix-demos/` SHALL NOT exist

#### Scenario: AGENTS.md reflects the removal

- **WHEN** the cleanup is applied
- **THEN** `AGENTS.md` SHALL list only the surviving specialized skills

### Requirement: headers skill is trimmed to its unique caveats

The `remix-headers` skill SHALL contain only the quoting/`Content-Length` caveats and SHALL NOT restate the SuperHeaders / header-class / raw-headers API.

#### Scenario: API restatement replaced with pointer

- **WHEN** the cleanup is applied
- **THEN** the API restatement sections SHALL be replaced with a pointer to `packages/headers/README.md`

### Requirement: html-template skill is trimmed to its unique deltas

The `remix-html-template` skill SHALL keep the standalone error pages and XSS-on-refactor warning, SHALL drop the safe-HTML/raw-HTML/composition API restatement, and SHALL not reference the stale app name `newapp`.

#### Scenario: API restatement replaced with pointer

- **WHEN** the cleanup is applied
- **THEN** the safe-HTML API restatement SHALL be replaced with a pointer to `packages/html-template/README.md`

#### Scenario: Stale app name fixed

- **WHEN** the cleanup is applied
- **THEN** the error-page example SHALL not contain the app name `newapp`

### Requirement: security-middleware skill is trimmed to its deltas

The `remix-security-middleware` skill SHALL keep the CSRF-form-required, webhook/SSE bypass, and clientEntry `<meta>` injection deltas, and SHALL condense the basic CSRF and CORS/COP API sections to pointers.

#### Scenario: CSRF-form delta preserved

- **WHEN** the cleanup is applied
- **THEN** the "every POST form needs `CsrfTokenInput`" and webhook/SSE skip-csrf content SHALL remain

#### Scenario: Basics condensed

- **WHEN** the cleanup is applied
- **THEN** the basic CSRF setup and CORS/COP sections SHALL be shortened to pointers to the csrf/cors/cop READMEs

### Requirement: forms skill Part 1 is shrunk

The `remix-forms` skill SHALL keep Parts 2–4 (delete confirmation, password patterns, session.flash routing) verbatim, and SHALL shrink Part 1 (`.optional()`/`.nullable()`) to a gotcha note pointing at `packages/data-schema/README.md`.

#### Scenario: Part 1 shrunk

- **WHEN** the cleanup is applied
- **THEN** Part 1 SHALL be a short gotcha note referencing the data-schema README

#### Scenario: Parts 2–4 preserved

- **WHEN** the cleanup is applied
- **THEN** Parts 2–4 SHALL retain their full content

### Requirement: form-error-handling-remix3 is modernized

The `form-error-handling-remix3` skill SHALL remove the deprecated URL-param Pattern 2 and its migration section, SHALL rewrite Common Mistakes #5/#7 to reference the direct re-render + `ShellOrFragment` patch, and SHALL fix stale `newapp/` paths.

#### Scenario: Deprecated pattern removed

- **WHEN** the cleanup is applied
- **THEN** Pattern 2 (URL-param roundtrip) and the Migration section SHALL be removed or reduced to a one-line legacy note

#### Scenario: Contradictory mistakes fixed

- **WHEN** the cleanup is applied
- **THEN** Common Mistakes #5 and #7 SHALL reference Pattern 1 / the shell patch instead of the deprecated URL-param pattern

#### Scenario: Stale paths fixed

- **WHEN** the cleanup is applied
- **THEN** the Reference Files section SHALL reference `app/...` paths, not `newapp/app/...`

### Requirement: mastra-tools Part 1 points to embedded docs

The `mastra-tools` skill SHALL keep the delta subsections (detached `this`, sequential approval chaining, SSE contract) and SHALL point Part 1's basic approval API at the embedded `@mastra/core` approval documentation.

#### Scenario: Part 1 basic API replaced with pointer

- **WHEN** the cleanup is applied
- **THEN** Part 1's basic `requireApproval`/`approveToolCallGenerate` API SHALL reference the embedded `docs-agents-agent-approval.md`

#### Scenario: Delta subsections preserved

- **WHEN** the cleanup is applied
- **THEN** the detached-`this`, sequential-chaining, and SSE-contract subsections SHALL remain

### Requirement: data-table-array-in-clause prefers inList()

The `remix3-data-table-array-in-clause` skill SHALL present the vendor `inList()` operator as the primary fix for multi-ID `findMany` queries.

#### Scenario: inList primary

- **WHEN** the cleanup is applied
- **THEN** the skill SHALL recommend `where: inList('id', ids)` as the primary approach

### Requirement: Unique skills remain untouched

The 21+ unique-content skills SHALL NOT be modified by this change beyond the listed trims.

#### Scenario: Unique skills unchanged

- **WHEN** the cleanup is applied
- **THEN** the generic traps, DB/migration, testing, mastra delta, and remix3 edge-case skills SHALL retain their content except where explicitly trimmed above
