## Context

The test agent (`app/actions/mastra/agents/test-agent.ts`) currently has two file tools in `app/actions/mastra/tools/test-tools.ts`:

- `listTestFiles(subdir)` — returns names + isDirectory flag
- `readTestFile(path)` — returns file content

The agent can discover what files exist but cannot answer questions about file size, recency, or structure. The proposed change adds optional sorting, filtering, and metadata to `listTestFiles` without introducing new tools.

## Goals / Non-Goals

**Goals:**

- Sort results by size, mtime, name, or extension
- Filter by extension
- Limit result count (max 100)
- Optional recursive traversal (excluding `.git` and `node_modules`)
- Return size (bytes) and mtime (Unix ms) per entry
- Update agent instructions to teach the new capabilities

**Non-Goals:**

- Content search or grep (use `readTestFile` for content)
- Write/modify/delete files
- Aggregate statistics (total size, file count by type — agent can derive these)
- Performance optimization beyond basic recursion guard

## Decisions

| Decision                 | Choice                                                                        | Rationale                                                         |
| ------------------------ | ----------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| One tool vs many         | Enrich `listTestFiles` with optional params                                   | Avoids tool proliferation. Agent learns one tool, varies params   |
| Default sort             | `name`, ascending                                                             | Backward compatible with current behavior (alphabetical listing)  |
| Stat approach            | `readdir` + `stat` per entry                                                  | No native `ls --stat` in Node. Acceptable at this project's scale |
| `node_modules` exclusion | Always excluded in recursive mode                                             | Would dominate results. No opt-out needed                         |
| `.git` exclusion         | Always excluded in recursive mode                                             | Implementation detail, not project content                        |
| Return shape             | Same `{ path, files: [...] }` — each entry gains `size`, `mtime`              | Non-breaking addition; existing fields unchanged                  |
| Input schema             | Same subdir param, new optional: `sort`, `order`, `limit`, `ext`, `recursive` | Zod v4 optional fields                                            |

## Risks / Trade-offs

- **Performance on large dirs** → Recursive mode stats every file. Cap at 100 output entries limits payload but not work. Acceptable for this project size (~1000 files without node_modules). If project grows, add a hard file-count ceiling.
- **Agent confusion** → Agent might request `{sort:"size"}` without `recursive` and get only the current directory's largest file. Mitigation: instructions teach that `recursive` should be set when sorting by size or mtime.
- **Backward compat** → Existing calls without new params work identically. New fields (`size`, `mtime`) are added alongside existing ones, so old callers are unaffected.
