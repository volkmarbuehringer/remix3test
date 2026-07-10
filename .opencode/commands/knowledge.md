---
description: List, filter, archive, or delete project knowledge files.
---

# Knowledge Command

Manage project knowledge files: $ARGUMENTS

## Usage

- `/knowledge` — List all active knowledge entries
- `/knowledge --tag <tag>` — Filter by tag
- `/knowledge --archived` — Include archived entries
- `/knowledge archive <title>` — Mark a knowledge entry as archived (skips auto-load)
- `/knowledge delete <title>` — Permanently remove a knowledge entry

## Your Task

### List mode (no subcommand or --tag)

Read `.agents/knowledge/` directory. For each file with `status: active`, display:

- Title
- Tags
- Created date
- Slug (filename without extension)

Show a summary like:

```
Active knowledge (3):
  [remix3, router] Remix 3 Router Import Fix (2026-05-31)
  [appointment, grid] Appointment Grid Collision Config (2026-05-30)
  [auth, csrf] CSRF Token Pattern (2026-05-28)

Archived knowledge (1):
  [forms] Old Form Validation (2026-04-15)
```

### Archive mode

Find the knowledge file by title (fuzzy match). Set `status: archived` in the frontmatter.

### Delete mode

Find the knowledge file by title (fuzzy match). Remove the file from disk.
