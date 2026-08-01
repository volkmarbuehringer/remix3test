## Context

`.opencode/skills/learned/` holds skills auto-extracted from past agent sessions. The vendor `remix` skill (`.opencode/skills/remix/`) + guides (`~/remix/guides/app/actions/docs/chapters/`) + package READMEs (`~/remix/packages/`) + Mastra vendor skill (`.claude/skills/mastra/`) are authoritative. Learned skills should preserve only the delta: failure modes, migration gotchas, and app conventions.

The audit classified all 45 learned skills. This design records the per-skill disposition and trim boundaries.

## Goals / Non-Goals

**Goals:**

- Eliminate skills that restate vendor/README content with no learned delta
- Trim partial duplicates to their unique delta
- Fix stale/conflicting guidance (deprecated URL-param pattern, stale paths)
- Prefer the vendor's canonical `inList()` operator over a raw-SQL workaround

**Non-Goals:**

- Rewriting application code — only agent guidance assets
- Restructuring `.opencode/skills/` layout or merging unrelated skills
- Expanding guide coverage

## Decisions

### Decision 1: Delete 4 pure-restatement skills

`remix-cookies` (46 lines), `remix-render-middleware` (52 lines), `remix-response-helpers` (61 lines), `remix-demos` (30 lines) restate their package READMEs / demo index with no learned delta. `remix-demos` is only a table of demo directories already documented by `AGENTS.md`.

**Action**: Delete all four. Update `AGENTS.md` (9 → 5) and the `remix-controllers/SKILL.md:524` reference to `remix-render-middleware`.

### Decision 2: Trim `remix-headers`

Lines 10–45 (SuperHeaders, Individual Header Classes, Raw Headers) restate `packages/headers/README.md`. Lines 47–75 (typing classes handle quoting natively, `Content-Length` accepts `number`) are unique.

**Action**: Delete lines 10–45; keep 47–79.

### Decision 3: Trim `remix-html-template`

Lines 10–43 (Safe HTML, Raw HTML, Composition) restate `packages/html-template/README.md`. Lines 44–139 (standalone error pages, full-document vs fragment, hardcoded theme values, XSS-on-refactor warning) are unique. Fix stale app name `newapp` at line 57.

**Action**: Delete lines 10–43; keep 44–143; fix line 57.

### Decision 4: Trim `remix-security-middleware`

Lines 10–22 (CSRF basics) and 133–153 (CORS + COP) restate the csrf/cors/cop middleware READMEs and guide ch10. Lines 24–131 (every POST form needs `CsrfTokenInput`, webhook `skip-csrf.ts` wrapper, `createAction`/`router.post()` 403s, clientEntry `<meta>` injection) and 155–199 (SSE CSRF bypass + `X-SSE-Request` header) are unique deltas.

**Action**: Condense 10–22 and 133–153 to pointers; keep deltas verbatim. Name must stay stable (3 cross-refs).

### Decision 5: Trim `remix-forms` Part 1

Part 1 (lines 20–63, `.optional()`/`.nullable()` top-level functions) restates `packages/data-schema/README.md`. Parts 2–4 are unique.

**Action**: Shrink Part 1 to a short gotcha note + pointer; keep Parts 2–4. Cross-link the select/coerce overlap to `form-error-handling-remix3`.

### Decision 6: Trim `form-error-handling-remix3`

Pattern 2 (URL-param roundtrip, lines 144–241) and the Migration section (244–315) document a deprecated pattern (the file itself says `form-params.ts` was removed). Common Mistakes #5 (line 736) and #7 (line 738) still recommend it, contradicting the `ShellOrFragment` patch in `remix3-frame-cliententry`. Lines 824–836 and 290–291 reference stale `newapp/` paths.

**Action**: Delete lines 144–315 (or reduce to a one-line "legacy, do not use" note); rewrite Common Mistakes #5/#7 to reference Pattern 1 + the shell patch; fix `newapp/` → `app/` paths. Name must stay stable (2 cross-refs).

### Decision 7: Trim `mastra-tools` Part 1

Part 1's basic API (lines 20–85: `requireApproval`, `requireToolApproval`, `approveToolCallGenerate`, `suspendPayload`) restates the embedded `node_modules/@mastra/core/dist/docs/references/docs-agents-agent-approval.md`. The delta subsections (detached `this`, sequential approval chaining, SSE contract) are unique.

**Action**: Point Part 1's basic API to the embedded doc; keep delta subsections. Name must stay stable (3 cross-refs).

### Decision 8: `remix3-data-table-array-in-clause` → prefer `inList()`

The skill recommends `db.exec` + `= ANY($1)` for multi-ID queries, bypassing the vendor's canonical array-membership operator `inList()` (exported at `packages/data-table/src/index.ts:127`, documented in the `data-and-validation.md` reference L177–183).

**Action**: Present `where: inList('id', ids)` as the primary fix; keep `= ANY($1)` only for order-preservation needs. Cross-link `remix-database-errors`.

## Risks / Trade-offs

| Risk | Mitigation |
| --- | --- |
| `AGENTS.md` names `remix-cookies`, `remix-render-middleware`, `remix-response-helpers`, `remix-demos` | Update list (9 → 5) as part of this change |
| `remix-controllers:524` references `remix-render-middleware` | Update to point at `render-middleware/README.md` |
| Trimmed skills are cross-referenced by name (`remix-security-middleware` ×3, `form-error-handling-remix3` ×2, `mastra-tools` ×3) | Only trim content; names stay stable |
| Removing deprecated Pattern 2 while live code still uses it | Confirmed no `form-params.ts` exists; skill asserts it was removed |
| `inList()` type-checks with the app's data-table version | Verify with a grep/typecheck before rewriting the skill |
