<!-- Context: core/context-system/operations | Priority: high | Version: 1.0 | Updated: 2026-04-03 -->

# Operations Navigation

**Purpose**: How to perform context operations (harvest, extract, organize, update, error, migrate)

**Last Updated**: 2026-04-03

---

## Quick Navigation

| Operation | File | Description | Priority |
|-----------|------|-------------|----------|
| **Harvest** | harvest.md | Extract knowledge from AI summaries → permanent context | critical |
| **Extract** | extract.md | Extract context from docs/code/URLs | medium |
| **Organize** | organize.md | Restructure flat files → function folders | medium |
| **Update** | update.md | Update context when APIs/frameworks change | medium |
| **Error** | error.md | Add recurring errors to knowledge base | medium |
| **Migrate** | migrate.md | Copy global context to local project | medium |

---

## Split Operations

For large operations (update.md, error.md), content split into:

| Operation | Main File | Sub-files |
|-----------|-----------|------------|
| Update | update.md | update-identify.md, update-apply.md |
| Error | error.md | error-dedupe.md |
| Organize | organize.md | organize-scan.md, organize-execute.md |
| Migrate | migrate.md | migrate-execute.md, migrate-conflicts.md |

---

## Loading Strategy

**For default behavior**: Load harvest.md
**For complex operations**: Load main file + sub-files as needed

---

## Related

- standards/mvi.md - MVI principle
- standards/templates.md - File templates
- guides/workflows.md - Interactive examples
