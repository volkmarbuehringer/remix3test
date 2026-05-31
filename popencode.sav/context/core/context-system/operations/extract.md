<!-- Context: core/extract | Priority: medium | Version: 1.1 | Updated: 2026-04-03 -->

# Extract Operation

**Purpose**: Extract context from docs, code, or URLs into organized context files

**Last Updated**: 2026-04-03

---

## When to Use

- Extracting from documentation
- Extracting from codebase patterns
- Extracting from URLs
- Creating initial context for new topics

---

## 7-Stage Workflow

### Stage 1: Read Source
Read and analyze source material

### Stage 2: Categorize
Extract and categorize content:

| Content Type | Folder |
|--------------|--------|
| Design decisions | `concepts/` |
| Working code | `examples/` |
| Step-by-step | `guides/` |
| Reference data | `lookup/` |
| Errors/gotchas | `errors/` |

---

### Stage 3: Select Category (APPROVAL REQUIRED)
User chooses target category and items

---

### Stage 4: Preview (APPROVAL REQUIRED)
Show what will be created, check for conflicts

---

### Stage 5: Create
Create files with MVI format (<200 lines each)

**Enforcement**: `@critical_rules.mvi_strict`

---

### Stage 6: Update Navigation
Update navigation.md with new files, add cross-references

---

### Stage 7: Report
```
✅ Extracted X items into {category}
📄 Created Y files
```

---

## Examples

```bash
/context extract from https://remix.run/docs
/context extract from docs/api.md
```

---

## Related

- standards/mvi.md - What to extract
- guides/compact.md - How to minimize
