# Re-auditing the App Against an Installed Guide Chapter

**Extracted:** 2026-10-31
**Context:** This repo pins a Remix preview build and carries authored vendor guides under
`node_modules/remix/guides/NN-*.md`. `docs/guide-skill-coverage.md` maps each chapter to its owner
skill and records gaps; `AGENTS.md` requires a re-audit when a chapter is authored/renamed or a
learned delta drifts. This is the workflow behind the §06 re-audit (2026-10-31).

## Problem

"Read the chapter and grep the app" fails in three ways:

1. **Misattributed drift.** The chapter may be byte-identical across the previous and current
   installs, so every deviation is app-side. Without checking, you fix against a guide that never
   changed.
2. **Trusting test names.** `readUntil(html => html.includes('Chat-Protokolle'))` followed by
   `assert.includes('Chat-Protokolle')` proves only that the stream ended; a green suite can hide a
   broken ordering claim.
3. **Stale learned references.** Line anchors and even behavioral claims (`render()` had no
   `onError`) rot with every pin bump; auditing only the app leaves the owner skill lying.

## Solution

### 1. Separate guide drift from app drift

Two codeload installs coexist after a bump; diff the chapter:

```bash
ls -d node_modules/.pnpm/remix@*
diff -u node_modules/.pnpm/remix@<old>/node_modules/remix/guides/06-streaming-ui-with-frames.md \
        node_modules/remix/guides/06-streaming-ui-with-frames.md
```

No output → the chapter is unchanged; record "byte-identical between builds `<old>` and `<new>`" in
the coverage note and audit app drift only.

### 2. Turn the chapter into claims, verify each in code

Walk the chapter section by section and find the app seam (not the test): the frame branch of the
shell/controller, the auth/404/500 path a blocking frame can hit, the resolver's headers/body
encoding, the route that serves both document and fragment. Keep a section → verdict → evidence
(`file:line`) table for the report.

### 3. Probe runtime behavior; do not trust test names

Run a throwaway `tmp/*.test.ts` against the real test router and record *cumulative offsets*, so
ordering is observable:

```ts
let html = ''
let fallbackAt = -1
let templateAt = -1
while (true) {
  let { done, value } = await reader.read()
  if (done) break
  html += decoder.decode(value, { stream: true })
  if (fallbackAt < 0 && html.includes('Inhalt wird geladen')) fallbackAt = html.length
  if (templateAt < 0 && html.includes('<template')) templateAt = html.length
}
assert.ok(fallbackAt > 0 && templateAt > fallbackAt, 'fallback must stream before the template')
```

Run it with `NODE_ENV=test npx remix test --type server --concurrency 1 tmp/<probe>.test.ts`
(imports from `tmp/` resolve to `../app/...`; setup gives the run an isolated DB, and `tmp/` is
gitignored), then delete the file. When a test names an ordering, read its assertion: replace
`readUntil(marker)` + `assert.includes(marker)` with a first-chunk assertion and a template-order
check.

### 4. Re-validate the owner skill in the same pass

Grep the owning reference for every app/vendor anchor and behavioral claim; re-pin `grep -n` results
and re-quote vendor source line numbers (`dist/server/stream.js:83`). Add a re-validation line to
the reference header. If a claim flipped (e.g. "the app passes no `onError`"), correct it instead
of deleting the delta.

### 5. Fix, then record in the registry

Land fixes with regression tests: middleware-order behavior needs a *server* test through the real
router stack; resolver/HTTP policy needs a browser test. Then update
`docs/guide-skill-coverage.md` — a dated paragraph in the intro plus the chapter row's
fix/deviation tail. Vendor guides stay canonical; record pointers and deltas, never the guide's API.

### 6. Verify the maintenance surface

```bash
npm run typecheck && npm run typecheck:unused && npm run lint && npm run format && npm run knip
npm run test:server && npm run test:browser && npm run test:e2e
```

An audit that touches shells or middleware touches every page: run the full suites, not only the
chapter's files.

## Traps

- **In-memory test stores mask persistence-order bugs.** `createMemorySessionStorage` returns the
  live `Session` object, so an internal re-fetch that runs before the session middleware saves still
  sees a flash; the fs store does not. Assert through the real router stack and check middleware
  order (`frameRedirects()` must sit outside `session()`).
- **A server-side follow is a second request.** Session save, transaction commit, and response
  headers belong to the outer response; a follow inside those middlewares re-reads pre-save state.
- **`createHtmlResponse` prepends a doctype to fragments.** Assert on `<html`/`Layout` markers, not
  `<!DOCTYPE`.
- **Unfinished chapters move.** Chapters 10/12/14/15 say "This chapter is unfinished."; record their
  gaps as watch items and re-audit on authoring.

## When to Use

- A chapter previously marked `unfinished` is now authored.
- A remix pin bump changed `node_modules/remix/guides/`.
- A learned reference is suspected stale, or you are asked to "review the app against chapter N".
