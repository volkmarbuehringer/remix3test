## 1. Delete obsolete restatement skills

- [x] 1.1 Delete `remix-cookies/`, `remix-render-middleware/`, `remix-response-helpers/`, `remix-demos/` directories
- [x] 1.2 Update `AGENTS.md` specialized-skills list (9 → 5)
- [x] 1.3 Update `remix-controllers/SKILL.md:524` reference to `remix-render-middleware`
- [x] 1.4 Verify no other skill references the four deleted skills by name

## 2. Trim remix-headers

- [x] 2.1 Delete lines 10–45 (SuperHeaders/Individual Header Classes/Raw Headers), replace with pointer to `packages/headers/README.md`
- [x] 2.2 Keep the quoting/Content-Length caveats section verbatim

## 3. Trim remix-html-template

- [x] 3.1 Delete lines 10–43 (Safe HTML/Raw HTML/Composition), replace with pointer to `packages/html-template/README.md`
- [x] 3.2 Keep standalone error pages + XSS-on-refactor warning
- [x] 3.3 Fix stale app name `newapp` at line 57

## 4. Trim remix-security-middleware

- [x] 4.1 Condense basic CSRF setup (lines 10–22) to a pointer to `csrf-middleware/README.md`
- [x] 4.2 Condense CORS/COP (lines 133–153) to pointers to cors/cop READMEs
- [x] 4.3 Keep the CSRF-form-required, webhook/SSE bypass, and clientEntry `<meta>` injection deltas verbatim

## 5. Trim remix-forms Part 1

- [x] 5.1 Shrink Part 1 (`.optional()`/`.nullable()`) to a gotcha note + pointer to `data-schema/README.md`
- [x] 5.2 Keep Parts 2–4 verbatim
- [x] 5.3 Add a cross-link from the select/coerce overlap to `form-error-handling-remix3`

## 6. Modernize form-error-handling-remix3

- [x] 6.1 Remove or reduce Pattern 2 (URL-param roundtrip, lines 144–241) to a one-line legacy note
- [x] 6.2 Remove the Migration section (lines 244–315)
- [x] 6.3 Rewrite Common Mistakes #5 and #7 to reference Pattern 1 / the `ShellOrFragment` patch
- [x] 6.4 Fix stale `newapp/` path references (lines 824–836, 290–291)

## 7. Trim mastra-tools Part 1

- [x] 7.1 Point Part 1's basic approval API to the embedded `docs-agents-agent-approval.md`
- [x] 7.2 Keep the detached-`this`, sequential-chaining, and SSE-contract delta subsections

## 8. Update remix3-data-table-array-in-clause

- [x] 8.1 Verify `inList()` type-checks with the app's data-table version
- [x] 8.2 Present `where: inList('id', ids)` as the primary fix; keep `= ANY($1)` for order preservation
- [x] 8.3 Cross-link `remix-database-errors`

## 9. Final verification

- [x] 9.1 Confirm only the intended skills changed (unique skills untouched)
- [x] 9.2 Verify no dangling cross-references to deleted skills
- [x] 9.3 Confirm `AGENTS.md` specialized-skills list matches reality
