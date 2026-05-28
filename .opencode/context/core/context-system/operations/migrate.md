<!-- Context: core/migrate | Priority: medium | Version: 1.1 | Updated: 2026-04-03 -->

# Context Migrate Operation

**Purpose**: Copy context from global (`~/.config/opencode/context/`) to local (`.opencode/context/`) for project-specific, git-committed patterns

**Last Updated**: 2026-04-03

---

## Core Problem

Global install has project-intelligence at `~/.config/opencode/context/project-intelligence/`. These files aren't git-committed or team-shared.

**Solution**: Migrate global → local so patterns are version-controlled.

---

## 4-Stage Workflow

### Stage 1: Detect Sources
Scan global config for context files.

```
Global location: ~/.config/opencode/context/
Found: project-intelligence/ (3 files)
Local: .opencode/context/
Status: [No local found / Local exists]
```

If no global context → Exit

---

### Stage 2: Check Conflicts (APPROVAL REQUIRED)
If local project-intelligence/ already exists:

```
Options:
  1. Skip existing — only copy files not present locally
  2. Overwrite all — replace local with global (backup first)
  3. Cancel

Choose [1/2/3]: _
```

If overwrite → Show diff before approval

---

### Stage 3: Copy
```
Will copy from: ~/.config/opencode/context/project-intelligence/
Will copy to:   .opencode/context/project-intelligence/

Files: technical-domain.md, navigation.md, business-domain.md

Proceed? [y/n]: _
```

---

### Stage 4: Cleanup & Confirm
```
✅ Copied X files

Clean up global project-intelligence?
  1. Keep global files (safe default)
  2. Remove global (only affects this user)
```

---

## What Gets Migrated

| Migrated (project-specific) | NOT Migrated (universal) |
|---|---|
| `project-intelligence/` | `core/` (standards, context-system) |

**Rationale**: Project intelligence is YOUR patterns. Core standards are universal.

---

## Related

- operations/migrate-execute.md - Copy details
- operations/migrate-conflicts.md - Conflict resolution
