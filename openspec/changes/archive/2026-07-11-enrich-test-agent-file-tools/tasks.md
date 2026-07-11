## 1. Enrich listTestFiles tool

- [x] 1.1 Add optional `sort`, `order`, `limit`, `ext`, `recursive` params to input schema in `listTestFiles`
- [x] 1.2 Read dependency: read current `test-tools.ts` to understand existing structure
- [x] 1.3 Implement stat collection: for each entry, call `fs.stat()` to get `size` and `mtimeMs`
- [x] 1.4 Implement sorting by `name`, `size`, `mtime`, `ext` with configurable `order`
- [x] 1.5 Implement `limit` parameter (max 100, hard-capped)
- [x] 1.6 Implement `ext` filter (skip non-matching files and all directories)
- [x] 1.7 Implement `recursive` traversal with `.git` and `node_modules` exclusion
- [x] 1.8 Ensure backward compat: default behavior (no extra params) returns same entries plus new `size`/`mtime` fields
- [x] 1.9 Run `npm test` to verify existing tests still pass

## 2. Update agent instructions

- [x] 2.1 Read current agent instructions in `test-agent.ts`
- [x] 2.2 Add instruction section describing new capabilities: sorting, filtering, limiting results

## 3. Tests

- [x] 3.1 Add test for sort by size (descending order)
- [x] 3.2 Add test for sort by mtime
- [x] 3.3 Add test for limit parameter
- [x] 3.4 Add test for ext filter
- [x] 3.5 Add test for recursive traversal
- [x] 3.6 Add test for node_modules exclusion in recursive mode
- [x] 3.7 Add test for limit cap at 100
- [x] 3.8 Add test for ext filter excluding directories
- [x] 3.9 Run `npm test` to verify all tests pass
- [x] 3.10 Run `npm run typecheck` to verify types

## 4. Verification

- [x] 4.1 Run `npm run lint` to verify no lint issues
- [x] 4.2 Run `npm test` for full test suite
- [x] 4.3 Smoke test: agent can answer "what's the biggest file in app/?"
