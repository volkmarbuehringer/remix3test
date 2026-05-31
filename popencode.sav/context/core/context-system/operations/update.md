<!-- Context: core/update | Priority: medium | Version: 1.1 | Updated: 2026-04-03 -->

# Update Operation

**Purpose**: Update context when APIs, frameworks, or contracts change

**Last Updated**: 2026-04-03

---

## When to Use

- Framework version updates (Next.js 14 → 15)
- API changes (breaking changes, deprecations)
- New features added to existing topics

---

## 8-Stage Workflow

### Stage 1: Identify Changes (APPROVAL REQUIRED)
**Action**: User describes what changed

```
What changed in {topic}?
  [A] API changes
  [B] Deprecations
  [C] New features
  [D] Breaking changes

Select all that apply:
```

---

### Stage 2: Find Affected Files
**Action**: Search for files referencing the topic

**Output**: List with reference counts per file

---

### Stage 3: Preview Changes (APPROVAL REQUIRED)
**Action**: Show line-by-line diff for each file

**Validation**: MUST get approval before proceeding

---

### Stage 4: Backup
**Action**: Create backup before updating

**Location**: `.tmp/backup/update-{topic}-{timestamp}/`

---

### Stage 5: Update Files
**Action**: Apply approved changes

**Enforcement**: `@critical_rules.mvi_strict`

---

### Stage 6: Add Migration Notes
**Action**: Add migration guide to errors/

---

### Stage 7: Validate
**Action**: Check references, links, file sizes (<200 lines)

---

### Stage 8: Report
**Action**: Show comprehensive results

---

## Change Types

| Type | Description |
|------|-------------|
| API Changes | Method signatures, parameters, return types |
| Deprecations | Features marked deprecated, replacements |
| New Features | New capabilities, APIs, patterns |
| Breaking Changes | Incompatible changes, migration required |

---

## Examples

```bash
/context update for Next.js 15
/context update for React 19 breaking changes
/context update for Stripe API v2024
```

---

## Related

- operations/update-identify.md - Stage 1 details
- operations/update-apply.md - Stages 2-5
- guides/workflows.md - Interactive diff examples
