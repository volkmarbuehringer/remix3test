<!-- Context: core/templates | Priority: high | Version: 2.1 | Updated: 2026-04-03 -->

# Context File Templates

**Purpose**: Standard formats for concept, example, guide, lookup, and error files with MVI compliance (<200 lines)

**Last Updated**: 2026-04-03

---

## Template Selection

| Type       | Max Lines | Required                                          |
| ---------- | --------- | ------------------------------------------------- |
| Concept    | 100       | Purpose, Core Idea, Key Points, Example, Reference |
| Example    | 80        | Purpose, Use Case, Code, Explanation              |
| Guide      | 150       | Purpose, Prerequisites, Steps, Verification       |
| Lookup     | 100       | Purpose, Tables/Lists                            |
| Error      | 150       | Symptom, Cause, Solution, Prevention              |
| Navigation | 50        | Purpose, Structure tree, Quick Routes             |

---

## Concept Template

```markdown
<!-- Context: {category}/concepts | Priority: {level} | Version: 1.0 -->
# Concept: {Name}

**Purpose**: [1 sentence]

## Core Idea
[1-3 sentences]

## Key Points
- Point 1
- Point 2
- Point 3

## Quick Example
```lang
[<10 lines]
```

## Reference
[Link to full docs]

## Related
- concepts/x.md
```

---

## Example Template

```markdown
<!-- Context: {category}/examples | Priority: high | Version: 1.0 -->
# Example: {What It Shows}

**Purpose**: [1 sentence]

## Use Case
[2-3 sentences]

## Code
```lang
[10-30 lines]
```

## Explanation
1. Step 1

## Related
- concepts/x.md
```

---

## Error Template

```markdown
<!-- Context: {category}/errors | Priority: high | Version: 1.0 -->
# Errors: {Framework}

**Purpose**: Common errors for {framework}

## Error: {Name}

**Symptom**: `{error message}`
**Cause**: [1-2 sentences]
**Solution**:
1. Step 1
**Code**:
```lang
// ❌ Before
// ✅ After
```
**Prevention**: [how to avoid]
```

---

## All Templates Must Have

1. HTML frontmatter (`<!-- Context: ... -->`)
2. Title with type prefix (`# Concept:`, `# Example:`, etc.)
3. **Purpose** (1 sentence)
4. **Related** section (cross-references)

---

## Validation Checklist

- [ ] Under max line limit?
- [ ] Has required sections?
- [ ] Cross-references added?
- [ ] Frontmatter correct?

---

## Related

- standards/mvi.md - MVI principle
- standards/structure.md - Structure rules
