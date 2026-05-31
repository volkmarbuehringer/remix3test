<!-- Context: core/error | Priority: medium | Version: 1.1 | Updated: 2026-04-03 -->

# Error Operation

**Purpose**: Add recurring errors to knowledge base with deduplication

**Last Updated**: 2026-04-03

---

## When to Use

- Encountered same error multiple times
- Want to document solution for team
- Building error knowledge base
- Preventing repeated debugging

---

## 6-Stage Workflow

### Stage 1: Search Existing
**Action**: Search for similar/related errors

**Process**:
1. Search error message across all errors/ files
2. Find similar errors (fuzzy matching)
3. Find related errors (same category)

---

### Stage 2: Check Duplication (APPROVAL REQUIRED)
**Action**: Present deduplication options

```
Options:
  [A] Add as new error to js-errors.md
  [B] Update existing 'Cannot read property X' error
  [C] Skip (already covered sufficiently)

Select option + category (e.g., 'B 1'):
```

**Validation**: MUST wait for user input

---

### Stage 3: Preview (APPROVAL REQUIRED)
**Action**: Show full error entry before adding

**Validation**: MUST get approval before proceeding

---

### Stage 4: Add/Update
**Action**: Add or update error entry

**Process**:
1. Add/update error in target file
2. Follow error template format
3. Maintain file size <150 lines
4. Update "Last Updated" date

---

### Stage 5: Update Navigation
**Action**: Update navigation.md and add cross-references

---

### Stage 6: Report
**Action**: Show results

```
✅ Added error to {category}/errors/{file}.md
🔗 Cross-referenced with X related errors
```

---

## Error Grouping

Group errors by framework/topic in single file:
- `js-errors.md` - All JavaScript errors
- `nextjs-errors.md` - All Next.js errors

**Don't create**: One file per error (too granular)

---

## Examples

```bash
/context error for "hooks can only be called inside components"
/context error for "Cannot read property 'map' of undefined"
```

---

## Related

- operations/error-dedupe.md - Deduplication strategy
- standards/templates.md - Error template format
