## Why

The learned skills under `.opencode/skills/learned/` accumulated over many agent sessions. A read-only audit compared the frame-related learned skills against the vendor Remix 3 guides (`~/remix/guides/app/actions/docs/chapters/*.md`), the vendor `remix` skill and its references, and the package READMEs (`~/remix/packages/`). Findings:

- `remix-fetch-proxy` is a near-verbatim restatement of `packages/fetch-proxy/README.md` with no learned delta — pure duplication.
- `remix-file-uploads` duplicates vendor multipart/storage API docs in its first ~54 lines, but its PostgreSQL `bytea` backend section (including the middleware-ordering gotcha) is genuinely unique and valuable.
- `remix3-frame-cliententry` (1835 lines) repeats `rmx-document` facts already in guide 05/06 and contains an off-topic mobile-nav section; the bulk of its content is unique and must be preserved.
- `remix3-standalone-route-admin-sidebar` §4 recommends `{ trustProxy: true }`, which the newer `remix3-two-tier-ip-trust-model` skill flags as spoofable — the standalone skill propagates insecure guidance.
- `remix3-multiple-route-trees` mostly restates vendor routing docs; only the CLI-discovery limitation is unique.
- `remix-routepattern-opaque-access` duplicates the route-pattern README's public API table; the migration warning is unique.
- `remix3-agent-routing`, `remix3-full-height-page-in-sidebar-shell`, `remix-route-relocation` have genuinely unique content not covered anywhere — keep as-is.

This change removes duplicate/obsolete content and trims skills to their unique deltas, so future sessions learn from authoritative vendor sources plus only the hard-won nuances the guides lack.

## What Changes

- Delete `remix-fetch-proxy` skill and replace with a pointer to the vendor `remix` skill / fetch-proxy README
- Trim `remix-file-uploads` to its PostgreSQL `bytea` backend delta (keep middleware-ordering gotcha)
- Trim `remix3-frame-cliententry` internal duplication and off-topic sections (keep all unique frame content)
- Trim `remix3-standalone-route-admin-sidebar`: remove the insecure `trustProxy: true` §4 and restated boilerplate; keep SSE-401 and `iframeNav` deltas
- Merge `remix3-multiple-route-trees` CLI note into `remix-cli-devops`, then delete the skill
- Trim `remix-routepattern-opaque-access` to the migration warning
- Update `AGENTS.md` where the removed skills are listed among the "11 specialized skills"

## Capabilities

### New Capabilities

None — this change modifies existing agent guidance assets, not application capabilities.

### Modified Capabilities

- `skill-cleanup`: The set of learned Remix 3 skills that SHALL be present in `.opencode/skills/learned/`, their required content (unique deltas only), and their pointer references to authoritative vendor sources.

## Impact

- **Files deleted**: `learned/remix-fetch-proxy/`, `learned/remix3-multiple-route-trees/`
- **Files modified**: `learned/remix-file-uploads/SKILL.md`, `learned/remix3-frame-cliententry/SKILL.md`, `learned/remix3-standalone-route-admin-sidebar/SKILL.md`, `learned/remix-routepattern-opaque-access/SKILL.md`, `AGENTS.md`
- **Files possibly created**: merged CLI-discovery note inside `learned/remix-cli-devops/SKILL.md`
- **Non-goals**: deleting or rewriting `remix3-agent-routing`, `remix3-full-height-page-in-sidebar-shell`, `remix-route-relocation`; touching any application source code
