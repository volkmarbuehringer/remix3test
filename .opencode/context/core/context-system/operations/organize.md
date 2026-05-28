<!-- Context: core/organize | Priority: medium | Version: 1.1 | Updated: 2026-04-03 -->

# Organize Operation

**Purpose**: Restructure flat context files into function-based folder structure

**Last Updated**: 2026-04-03

---

## When to Use

- Migrating from flat to function-based structure
- Cleaning up disorganized directories
- Splitting ambiguous files into categories

---

## 8-Stage Workflow

### Stage 1: Scan
Scan category for all files, detect structure type

### Stage 2: Categorize
Categorize each file by function:

| Type | Folder |
|------|--------|
| Explains concept | `concepts/` |
| Shows working code | `examples/` |
| Step-by-step | `guides/` |
| Reference data | `lookup/` |
| Errors/issues | `errors/` |

---

### Stage 3: Resolve Conflicts (APPROVAL REQUIRED)

```
Ambiguous files (need your input):
  [?] api-design.md (concepts AND steps)
      → [A] Split into concepts/ + guides/
      → [B] Keep as concepts/
      → [C] Keep as guides/

Conflicts:
  [!] auth.md → target exists
      → [J] Merge into existing
      → [K] Rename to auth-v2.md

Select resolutions:
```

---

### Stage 4: Preview (APPROVAL REQUIRED)
Show preview of all changes

### Stage 5: Backup
Create backup at `.tmp/backup/organize-{category}-{timestamp}/`

---

### Stage 6: Execute
Create folders, move files, split/merge as planned

---

### Stage 7: Update
Fix references, update navigation.md

---

### Stage 8: Report
```
✅ Organized X files into function folders
📁 Created Y new folders
🔀 Split Z ambiguous files
```

---

## Examples

```bash
/context organize development/
/context organize development/ --dry-run
```

---

## Related

- operations/organize-scan.md - Stage 1-2 details
- operations/organize-execute.md - Stages 4-7
- standards/structure.md - Folder rules
