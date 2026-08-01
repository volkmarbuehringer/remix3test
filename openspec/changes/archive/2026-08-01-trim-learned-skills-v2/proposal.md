## Why

A second full audit of `.opencode/skills/learned/` compared all 45 learned skills against the vendor corpus (Remix guides chapters 01–17, the vendor `remix` skill + its `references/`, package READMEs under `~/remix/packages/`, the Mastra vendor skill + embedded `@mastra/core` docs, and the OpenSpec skills). Findings:

- **4 skills are near-verbatim restatements of vendor READMEs/demos** with no learned delta: `remix-cookies` (restates `packages/cookie/README.md`), `remix-render-middleware` (same examples as `render-middleware/README.md`), `remix-response-helpers` (restates `response/README.md`), `remix-demos` (only an index table of demo dirs already documented in AGENTS.md).
- **6 skills mix vendor-restated sections with genuinely unique deltas**: `remix-headers`, `remix-html-template`, `remix-security-middleware`, `remix-forms`, `form-error-handling-remix3`, `mastra-tools`.
- **`form-error-handling-remix3` has stale/conflicting guidance**: it deprecates the URL-param pattern but Common Mistakes #5/#7 still recommend it, contradicting the `ShellOrFragment` patch in `remix3-frame-cliententry`; it also has stale `newapp/` path references.
- **`remix3-data-table-array-in-clause` bypasses the canonical `inList()` operator** the vendor provides, recommending a raw `= ANY($1)` workaround instead.
- 21+ skills have genuinely unique content (generic language traps, DB/migration gotchas, testing patterns, mastra deltas, remix3 edge cases) — keep as-is.

This change deletes/trims the duplicate content so future sessions read the authoritative vendor sources plus only the hard-won deltas the vendor docs lack.

## What Changes

- Delete `remix-cookies`, `remix-render-middleware`, `remix-response-helpers`, `remix-demos` (replace with vendor pointers)
- Trim `remix-headers` to the quoting/Content-Length caveats
- Trim `remix-html-template` to standalone error pages + XSS-regression warning (fix stale `newapp` title)
- Trim `remix-security-middleware` to the CSRF/SSE deltas (condense basics to pointers)
- Trim `remix-forms` Part 1 to a gotcha note (keep Parts 2–4)
- Trim `form-error-handling-remix3`: remove deprecated Pattern 2 + migration, fix conflicting Common Mistakes #5/#7, fix stale `newapp/` paths
- Trim `mastra-tools` Part 1 to point at the embedded `@mastra/core` approval docs (keep delta subsections)
- Update `remix3-data-table-array-in-clause` to present `inList()` as the primary fix
- Update `AGENTS.md` specialized-skills list (9 → 5)
- Fix the `remix-controllers` reference to `remix-render-middleware`

## Capabilities

### New Capabilities

None — this change modifies existing agent guidance assets.

### Modified Capabilities

- `skill-cleanup-v2`: The set of learned skills that SHALL be present in `.opencode/skills/learned/`, their required content (unique deltas only), and their pointers to authoritative vendor sources.

## Impact

- **Files deleted**: `learned/remix-cookies/`, `learned/remix-render-middleware/`, `learned/remix-response-helpers/`, `learned/remix-demos/`
- **Files modified**: `learned/remix-headers/SKILL.md`, `learned/remix-html-template/SKILL.md`, `learned/remix-security-middleware/SKILL.md`, `learned/remix-forms/SKILL.md`, `learned/form-error-handling-remix3/SKILL.md`, `learned/mastra-tools/SKILL.md`, `learned/remix3-data-table-array-in-clause/SKILL.md`, `learned/remix-controllers/SKILL.md`, `AGENTS.md`
- **Non-goals**: deleting or rewriting the 21+ unique-content skills; touching application source code
