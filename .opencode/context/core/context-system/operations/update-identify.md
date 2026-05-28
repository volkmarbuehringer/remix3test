<!-- Context: core/update-identify | Priority: medium | Version: 1.0 | Updated: 2026-04-03 -->

# Update: Identify Changes (Stage 1)

**Purpose**: Gather details about framework/API changes for context updates

**Last Updated**: 2026-04-03

---

## Input Collection

### Framework Updates
```
What changed in {topic}?
  [A] API changes
  [B] Deprecations
  [C] New features
  [D] Breaking changes
```

### Follow-up Questions

For each selected type, gather:

| Type | Questions |
|------|-----------|
| API changes | What methods changed? What parameters added/removed? |
| Deprecations | What's deprecated? What's replacement? Timeline? |
| New features | What's new? How to use? |
| Breaking changes | What's incompatible? Migration steps? |

---

## Output Format

After gathering input:

```
Change Summary:
- API Changes: [list]
- Deprecations: [list]
- New Features: [list]
- Breaking Changes: [list]

Proceed to Stage 2: Find affected files? [y/n]
```

---

## Related

- operations/update.md - Main workflow
- operations/update-apply.md - Execution stages
