<!-- Context: core/error-dedupe | Priority: medium | Version: 1.0 | Updated: 2026-04-03 -->

# Error Deduplication Strategy

**Purpose**: Prevent duplicate error entries while building comprehensive knowledge base

**Last Updated**: 2026-04-03

---

## Deduplication Rules

### Similar Errors
Same root cause, different manifestations
→ **Update existing** to include new examples

### Related Errors
Different causes, same category
→ **Cross-reference** between errors

### Duplicate Errors
Exact same error already documented
→ **Skip** (already covered)

### New Errors
Unique error not yet documented
→ **Add as new** error entry

---

## Update Strategy

When adding new error variants:

1. Check existing error for similar root cause
2. If found: Add example to existing, don't create new
3. If not found: Check related category
4. If related exists: Cross-reference, add as new
5. If neither: Add as new error entry

---

## Example: Property Access Errors

| New Error | Existing | Action |
|-----------|----------|--------|
| `Cannot read property 'map' of undefined` | `Cannot read property 'X' of undefined` | Update existing |
| `Cannot read property 'length' of undefined` | Same existing | Update existing |
| `Undefined is not an object` | Different cause | Cross-reference |

---

## Template Format

```markdown
## Error: {Name}

**Symptom**: `{error message}`
**Cause**: [1-2 sentences]
**Solution**: [Steps]
**Code**: [Before/After example]
**Prevention**: [how to avoid]
**Frequency**: common/occasional/rare
**Reference**: [Link]
```

---

## Related

- operations/error.md - Core workflow
- standards/templates.md - Full template
