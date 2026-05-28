<!-- Context: core/workflows | Priority: high | Version: 2.0 | Updated: 2026-03-26 -->

# Context Operation Workflows

**Core Concept**: Interactive workflows for extract, organize, update, and error operations with mandatory approval gates.

**Last Updated**: 2026-03-26

---

## Quick Reference

| Operation | Command                          | Key Stage                                       |
| --------- | -------------------------------- | ----------------------------------------------- |
| Harvest   | `/context harvest`               | Clean → Extract → Report                        |
| Extract   | `/context extract from {source}` | Read → Categorize → Preview → Create            |
| Organize  | `/context organize {category}`   | Scan → Categorize → Resolve → Preview → Execute |
| Update    | `/context update for {topic}`    | Identify → Find → Preview → Update              |
| Error     | `/context error for {error}`     | Search → Check → Preview → Add                  |

---

## Common Patterns

### Approval Gates

All operations MUST show preview before executing:

1. What will be created/modified/deleted
2. File sizes (before → after)
3. Options: yes/no/edit/dry-run

### Conflict Resolution

When conflicts detected:

1. Present all options with letter selection (A/B/C)
2. Show impact of each option
3. Allow user to choose resolution

### Backups

Operations that modify files:

1. Create backup in `.tmp/backup/{operation}-{timestamp}/`
2. Report backup location
3. Keep rollback available

---

## Workflow Summary

### Extract

```
/context extract from https://remix.run/docs
  → Read source → Categorize → Select items → Preview → Create
```

### Organize

```
/context organize development/
  → Scan flat files → Categorize by function → Resolve conflicts → Preview → Execute
```

### Update

```
/context update for Next.js 15
  → Identify changes → Find affected files → Preview diffs → Apply approved changes
```

### Error

```
/context error for "Cannot read property 'map' of undefined"
  → Search existing → Check duplication → Preview → Add to errors/
```

---

## Key Principles

- **Extract**: Group by function (concepts/errors/guides/examples)
- **Organize**: Split ambiguous files by function
- **Update**: Keep files under 200 lines, reference full docs
- **Error**: Group by framework, not one file per error

---

## Reference

Full interactive examples: `operations/harvest.md`, `operations/extract.md`, `operations/organize.md`, `operations/update.md`, `operations/error.md`

MVI principle: `standards/mvi.md`
