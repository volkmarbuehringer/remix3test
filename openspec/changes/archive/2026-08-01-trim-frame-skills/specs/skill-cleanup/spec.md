# Skill Cleanup — Capability Spec

## MODIFIED Requirements

### Requirement: Obsolete fetch-proxy skill is removed

The `remix-fetch-proxy` skill SHALL NOT exist in `.opencode/skills/learned/`. Coverage of `remix/fetch-proxy` SHALL be provided by the vendor `remix` skill and the fetch-proxy package README.

#### Scenario: Skill directory no longer present

- **WHEN** the cleanup is applied
- **THEN** `.opencode/skills/learned/remix-fetch-proxy/` SHALL NOT exist

#### Scenario: AGENTS.md reflects removal

- **WHEN** the cleanup is applied
- **THEN** `AGENTS.md` SHALL reference the vendor `remix` skill for fetch-proxy coverage instead of the removed learned skill

### Requirement: file-uploads skill is trimmed to its unique delta

The `remix-file-uploads` skill SHALL contain only the PostgreSQL `bytea` backend content: the `uploadHandler` streaming into `bytea`, the `formData()`-runs-before-auth ordering gotcha with its `uploaded_by = null` fixup, the download endpoint via standalone `createAction`, and the `void`-handler in-memory failure-detection trick.

#### Scenario: Generic multipart API sections removed

- **WHEN** the cleanup is applied
- **THEN** the multipart parsing, size-limit, and file-storage sections SHALL be replaced with a pointer to the vendor READMEs (`multipart-parser`, `form-data-middleware`, `file-storage`)

#### Scenario: Bytea delta preserved verbatim

- **WHEN** the cleanup is applied
- **THEN** the PostgreSQL `bytea` backend section SHALL remain intact, including the middleware-ordering gotcha

### Requirement: frame-cliententry skill is deduplicated

The `remix3-frame-cliententry` skill SHALL retain all unique frame content and SHALL remove the identified overlap sections: the duplicated `rmx-document` attribute facts, the "on Mixin Requires clientEntry" base rule, and the off-topic Mobile Nav Hamburger section.

#### Scenario: rmx-document sections collapsed

- **WHEN** the cleanup is applied
- **THEN** the "Binary File Downloads in Frames" and "Cross-Section Navigation CPU Loop" sections SHALL be merged into a single section keeping only the crash/loop symptoms and the `X-Remix-Frame` 302 guard, and the duplicate `rmx-document` attribute fact SHALL appear only once

#### Scenario: Unique frame content preserved

- **WHEN** the cleanup is applied
- **THEN** the form-interception root cause, clientEntry cascade limit, mounted-guard after frame reload, reloadComplete data loading, CSS child-selector restriction, inline-edit, drag/drop, fragment scrolling, test verification, frame target registration, input value preservation, and frame direct render sections SHALL remain

### Requirement: standalone-route-admin-sidebar no longer recommends spoofable trustProxy

The `remix3-standalone-route-admin-sidebar` skill SHALL NOT recommend `{ trustProxy: true }` for client-IP extraction. The SSE-401 auth and `iframeNav: false` deltas SHALL be preserved.

#### Scenario: Insecure §4 removed and redirected

- **WHEN** the cleanup is applied
- **THEN** §4 (client IP with `trustProxy: true`) SHALL be removed and replaced with a pointer to `remix3-two-tier-ip-trust-model`

#### Scenario: SSE-401 delta preserved

- **WHEN** the cleanup is applied
- **THEN** the §3 content about SSE endpoints needing 401-auth (`requireSseAuth()`) SHALL remain

### Requirement: multiple-route-trees CLI note is merged and skill removed

The `remix3-multiple-route-trees` skill SHALL NOT exist in `.opencode/skills/learned/`. Its unique CLI-discovery limitation SHALL be documented in `remix-cli-devops`.

#### Scenario: Skill directory no longer present

- **WHEN** the cleanup is applied
- **THEN** `.opencode/skills/learned/remix3-multiple-route-trees/` SHALL NOT exist

#### Scenario: CLI note merged

- **WHEN** the cleanup is applied
- **THEN** `remix-cli-devops` SHALL document that `remix routes` only discovers the first/default route tree when multiple named exports exist

### Requirement: routepattern-opaque-access is trimmed to the migration warning

The `remix-routepattern-opaque-access` skill SHALL keep the RoutePattern opacity migration warning (beta.5, `pathname.tokens` breakage, `.source.replace(...)` rewrite) and SHALL drop the duplicated public API table in favor of a pointer to the route-pattern README.

#### Scenario: Migration warning preserved

- **WHEN** the cleanup is applied
- **THEN** the migration warning and the `.source.replace(...)` rewrite technique SHALL remain

#### Scenario: API table replaced with pointer

- **WHEN** the cleanup is applied
- **THEN** the public API table SHALL be replaced with a pointer to the route-pattern package README

### Requirement: Unique skills remain untouched

The `remix3-agent-routing`, `remix3-full-height-page-in-sidebar-shell`, and `remix-route-relocation` skills SHALL NOT be modified by this change.

#### Scenario: Skills unchanged

- **WHEN** the cleanup is applied
- **THEN** the three skills listed above SHALL retain their full content
