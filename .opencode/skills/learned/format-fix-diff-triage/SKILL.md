---
name: format-fix-diff-triage
description: "Use when a repo-wide format:fix (oxfmt/prettier/black/gofmt) rewrote files you never edited, or when reverting unrelated dirty files risks destroying pre-existing uncommitted work — classify each unrelated diff as format-only vs content by whitespace-stripped hash and revert only the provably format-only files."
origin: auto-extracted
---

# Formatter Diff Contamination Triage

**Extracted:** 2026-10-05

**Context:** A session ran the repo-blessed `npm run format:fix` to normalize its own edits. The formatter rewrote ~25 files the session never touched — the committed baseline itself was not formatter-clean — while the working tree simultaneously held the user's own uncommitted work (feature edits, a dependency bump). The goal: keep the session diff focused without reverting anyone else's changes.

## Problem

- `git status` cannot distinguish "dirtied by my formatter run" from "dirty before the session started" — there is no snapshot of session start.
- You must not blanket-revert unrelated files: some contain pre-existing content edits, and `git checkout --` would destroy work you did not do.
- `git diff -w` / `--ignore-all-space` misclassifies: re-wrapping changes line breaks, and the formatter often **adds trailing commas**, which are non-whitespace tokens — so real reformat-only files still show as content changes.

## Solution

Compare each unrelated file against HEAD with **all whitespace stripped** — reflow is then invisible; only token changes survive:

```bash
for f in $(git diff --name-only); do
  case "$f" in <files-you-actually-edited>) continue ;; esac
  a=$(git show "HEAD:$f" | tr -d '[:space:]' | md5sum | cut -d' ' -f1)
  b=$(tr -d '[:space:]' < "$f" | md5sum | cut -d' ' -f1)
  if [ "$a" = "$b" ]; then echo "FORMAT-ONLY: $f"; else echo "CONTENT:     $f"; fi
done
```

- **FORMAT-ONLY** → token content identical to HEAD → safe: `git checkout -- "$f"`.
- **CONTENT** → leave it. It either holds pre-existing edits *or* is formatting that added trailing commas/semicolons. The classifier has **no false negatives** (commas count as content), so its only error mode is keeping harmless noise — the safe direction. Never revert a CONTENT file to "clean up" a diff.
- Afterwards re-verify once (`npm run typecheck` / build): the reverted files are provably whitespace-identical, so one check settles it.

Prevention and companion traps:

- Prefer the scoped formatter over the repo-wide one once a dirty baseline is discovered: `npx oxfmt <your-files> --write` (or `npx prettier --write <files>`, `black <files>`, `gofmt -w <files>`). A repo-wide run only makes sense if the baseline is formatter-clean to begin with.
- If a new file you created is imported by your modified files, it shows as `??` in `git status`; `git add` of just the modified files yields a broken tree in CI. Stage every `??` file your change introduced together with the edits.
- Keep an explicit list of the files your session actually edited — it is the `case` allowlist above and the source of truth for what belongs in the commit message.

## When to Use

- After a repo-wide format run, `git status` lists files outside your edit set.
- Asked to "revert the formatter noise" on a tree that also contains someone's uncommitted work.
- Before committing from a shared/dirty working tree, to separate your change from the baseline.
