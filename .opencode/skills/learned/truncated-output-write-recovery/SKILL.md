---
name: truncated-output-write-recovery
description: "Use when a file contains a literal line-truncated marker, a table row or document ends mid-sentence at a round character count, or a whole-file rewrite was based on Read/grep/terminal output — recover the untruncated content from git without losing later edits."
metadata:
  origin: auto-extracted
---

# Recovering Files Written from Truncated Tool Output

**Extracted:** 2026-11-14
**Context:** A documentation registry was rewritten from a `Read`/display view. Long Markdown table rows exceeded the harness's 2,000-character per-line display cap, so the harness's literal `line truncated` display marker was written into 18 rows and the trailing sections were dropped. The file still parsed and passed the formatter; only a targeted grep revealed the corruption.

## Problem

- Harnesses truncate long lines in tool output and append a display marker. Copying that output into a whole-file write persists the marker as real content.
- The corruption is silent: Markdown, YAML, and commented code still parse, and formatters do not remove the marker.
- Re-reading the corrupted file through the same tool shows the same truncation, which can confirm the illusion.
- Reverting the whole file to the pre-corruption commit loses legitimate edits made after the corrupting commit.

## Solution

### Detect

```bash
rg -n "\(line truncated to \d+ chars\)" .
git log -S "(line truncated to" -- <path>
git show <bad-commit>^:<path> | rg -c "\(line truncated"
```

Also check suspicious line lengths (the cap is harness-specific; 2,000 here):

```bash
awk 'length($0) > 1990 { print FNR ":" length($0) }' <path>
```

A long line can be legitimate; the literal marker is the definitive signal.

### Recover

1. Find the introducing commit:
   `git log -S "(line truncated to" -- <path>`
2. Recover the content before it:
   `git show <bad-commit>^:<path> > /tmp/recovered`
3. Re-apply later edits. Compare each row/section against `HEAD`; separate intended post-corruption changes from the truncation. In the source case only rows 05 and 09 had changed, so those were re-applied and all other rows restored verbatim.
4. Replace only the corrupted block. Keep intro/history paragraphs that postdate the corrupting commit.
5. Restore trailing sections that the whole-file write dropped.
6. Verify:
   - `rg -c "\(line truncated to \d+ chars\)" <path>` returns `0`
   - the table/section count matches the source plus intended edits
   - `npx oxfmt --check <path>` (or the project formatter) passes
   - `git diff --check` is clean

### Prevention

- Use the `edit` tool with exact substrings for existing files; avoid whole-file writes built from a `Read` view.
- Regenerate large table rows from their source (git, JSON, database), not from display output.
- After any whole-file write, grep for the truncation marker and inspect lines near the cap.
- Treat the marker as corruption, never as content.

## When to Use

- A file contains `... (line truncated to ...)` as literal text.
- A Markdown table row or document ends mid-word at a round character count.
- A whole-file rewrite was based on `Read`, `grep`, or terminal output.
- Restoring from git risks losing edits made after the corrupting commit.
