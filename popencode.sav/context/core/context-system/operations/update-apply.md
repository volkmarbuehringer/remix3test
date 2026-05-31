<!-- Context: core/update-apply | Priority: medium | Version: 1.0 | Updated: 2026-04-03 -->

# Update: Apply Changes (Stages 2-5)

**Purpose**: Execute context updates after identifying changes

**Last Updated**: 2026-04-03

---

## Stage 2: Find Affected Files

Grep for topic references across all context files.

```
Found X files referencing {topic}:
  📄 file1.md (3 refs)
  📄 file2.md (1 ref)
```

---

## Stage 3: Preview Changes (APPROVAL REQUIRED)

Show line-by-line diff:

```
Line N:
  - Old content
  + New content
```

**Edit mode**: Allow modifications before approval

---

## Stage 4: Backup

Create backup at `.tmp/backup/update-{topic}-{timestamp}/`

Enable rollback if updates cause issues.

---

## Stage 5: Update Files

Process:
1. Update concepts, examples, guides, lookups
2. Maintain MVI format (<200 lines)
3. Update "Last Updated" dates
4. Preserve file structure

**Enforcement**: `@critical_rules.mvi_strict`

---

## Migration Notes

Add to `{category}/errors/{topic}-errors.md`:

```markdown
## Migration: {Old} → {New}

**Breaking Changes**:
- Change 1

**Migration Steps**:
1. Step 1

**Reference**: [Link]
```

---

## Validation Checks

- All internal references work
- No broken links
- All files <200 lines
- MVI format maintained

---

## Related

- operations/update.md - Main workflow
- operations/update-identify.md - Stage 1
