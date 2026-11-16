---
name: file-write-payload-escapes
description: "Use when a tools.write payload dies with a bare parse error (Expected ',', got 'ident', or Expected a semicolon) although the content looks valid, when generated source lost a backslash (a regex reading /s+/ instead of the intended whitespace class), or before writing a file whose content itself contains backticks or ${...} template literals."
metadata:
  origin: auto-extracted
---

# Writing File Content From Agent Programs

**Extracted:** 2026-11-16
**Context:** Rewriting `app/ui/admin-offering-configs-page.tsx` (~1,300 lines of TSX with `css()` template literals) from a `run_code` program. Four writes died with a syntax error pointing at the program, and the first write that ran silently corrupted a regex (`/s+/g` instead of `/\s+/g`).

## Problem

`tools.write` receives the content as a program value, so the content is first a JavaScript literal. When it is TSX/TS/Markdown full of template literals:

1. **A backtick in the payload terminates the enclosing template literal.** `String.raw` does not change this — it only stops backslash processing. The program fails with `Expected ',', got 'ident'` or `Expected a semicolon`, pointing at a payload line that looks fine.
2. **`${...}` still interpolates inside `String.raw`.** A payload containing `${h}:${m}` is evaluated as the program's own interpolation.
3. **Mixing raw and normal fragments silently drops backslashes.** Building the payload as a raw template plus a normal string for the backtick-heavy lines processes the normal part: `\s` becomes `s`. The write succeeds and the file contains `/s+/g`, which type-checks and only shows up as wrong behaviour.
4. Nothing is written on a parse failure, and the reported line is in the payload rather than at the construct that broke it, so each retry costs a full program run.

## Solution

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

## When to Use

- A `run_code`/`tools.write` call dies with `Expected ',', got 'ident'` or `Expected a semicolon` while the payload looks syntactically correct.
- You are about to write TS/TSX/Markdown whose content contains backticks or `${`.
- Generated source compiles but behaves oddly — check for a lost backslash first.
- A probe/scratch script exists in the tree before the repo's verification gates.

## Related

- `remix3-tooling § Testing` → `references/remix3-testing/testing-hygiene.md` — `/tmp` is private to one command execution; screenshots and scratch artifacts belong under the repo's gitignored `tmp`.
- `truncated-output-write-recovery` — the sibling failure mode: whole-file writes built from display-truncated `Read` output.
