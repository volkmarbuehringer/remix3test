# Agent Write Safety: Payload Escapes & Truncation Recovery

Two failure modes when an agent writes a file: a `tools.write` payload is a program literal before it is file content, so template syntax can corrupt it, and a whole-file write built from `Read`/display output can persist the harness's display-truncation marker. Both can leave a file that parses, formats, and even type-checks.

Consolidated from the former `file-write-payload-escapes` (2026-11-16) and `truncated-output-write-recovery` (2026-11-14) skills.

## Payload escapes: `tools.write` from a program

### Problem

`tools.write` receives the content as a program value, so the content is first a JavaScript literal. When it is TSX/TS/Markdown full of template literals:

1. **A backtick in the payload terminates the enclosing template literal.** `String.raw` does not change this — it only stops backslash processing. The program fails with `Expected ',', got 'ident'` or `Expected a semicolon`, pointing at a payload line that looks fine.
2. **`${...}` still interpolates inside `String.raw`.** A payload containing `${h}:${m}` is evaluated as the program's own interpolation.
3. **Mixing raw and normal fragments silently drops backslashes.** Building the payload as a raw template plus a normal string for the backtick-heavy lines processes the normal part: `\s` becomes `s`. The write succeeds and the file contains `/s+/g`, which type-checks and only shows up as wrong behaviour.
4. Nothing is written on a parse failure, and the reported line is in the payload rather than at the construct that broke it, so each retry costs a full program run.

### Solution

Pick the transport from what the payload contains; do not try to "escape harder" inside a template literal.

| Payload contains | Transport |
| --- | --- |
| no backtick, no `${` | `String.raw` template — backslashes survive |
| `${` only | single-quoted strings (or an array of single-quoted lines joined with `\n`); split `'$' + '{'` if needed |
| backticks | `const BT = String.fromCharCode(96)` and concatenate |
| both | array of single-quoted lines using `BT` |

```ts
const BT = String.fromCharCode(96)
let content = [
  'const label = ' + BT + '${h}:${m}' + BT,
  // A backslash still escapes inside a program string: \\s writes \s.
  'const cleaned = label.replace(/\\s+/g, " ")',
].join('\n')
```

Only backticks need the `BT` trick; inside single-quoted strings `${` is literal.

Shortcuts, in order of preference:

1. Write the file in anchored `edit` calls (one block per call) instead of one whole-file write; a block without backticks is trivially safe.
2. Keep prose backticks out of generated comments (quote identifiers with `"..."`); comment-only backticks are not worth a parse failure.
3. A quoted heredoc (`cat > file <<'EOF'`) has the same constraint: the command is still a program string, so it must be single-quoted/array-built, not a template literal.

### Verify the write

After any generated-source write, read the file back and grep for corruption that still compiles:

```bash
# a character class that lost its backslash: /s+/ where /\s+/ was meant
grep -nE '\(/[a-zA-Z]\+/' <path>
# literal escape text that should have been interpreted
grep -nF '\u' <path>
# backticks should only be where a template literal is intended
grep -n '`' <path>
```

- `npx tsc --noEmit` is necessary but not sufficient: `/s+/g` is valid TypeScript.
- Compare the high-risk lines (regexes, escapes, template literals) against the draft.

### Keep scratch programs out of the checked-in tree

- The gitignored `tmp/` is the scratch area, but `tsc` still compiles `tmp/*.ts(x)` here (no narrowed `include`/`exclude`), so a broken probe fails `npm run typecheck`.
- A scratch file at the repo root fails `npm run lint`: `oxlint` scans the cwd and skips gitignored paths, not untracked root files.
- Delete probes before the final `typecheck`/`lint`/`format`/`knip` gate and confirm `git status` is clean.

## Truncation recovery: whole-file writes from tool output

### Problem

- Harnesses truncate long lines in tool output and append a display marker. Copying that output into a whole-file write persists the marker as real content.
- The corruption is silent: Markdown, YAML, and commented code still parse, and formatters do not remove the marker.
- Re-reading the corrupted file through the same tool shows the same truncation, which can confirm the illusion.
- Reverting the whole file to the pre-corruption commit loses legitimate edits made after the corrupting commit.

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

- A `run_code`/`tools.write` call dies with `Expected ',', got 'ident'` or `Expected a semicolon` while the payload looks syntactically correct.
- You are about to write TS/TSX/Markdown whose content contains backticks or `${`.
- Generated source compiles but behaves oddly — check for a lost backslash first.
- A probe/scratch script exists in the tree before the repo's verification gates.
- A file contains `... (line truncated to ...)` as literal text.
- A Markdown table row or document ends mid-word at a round character count.
- A whole-file rewrite was based on `Read`, `grep`, or terminal output.
- Restoring from git risks losing edits made after the corrupting commit.

## See Also

- `remix3-tooling § Testing` → `references/remix3-testing/testing-hygiene.md` — `/tmp` is private to one command execution; screenshots and scratch artifacts belong under the repo's gitignored `tmp`.
- `dev-gotchas § Format Triage` — the adjacent tool-induced corruption: a repo-wide formatter rewrote files outside the session's edit set.
