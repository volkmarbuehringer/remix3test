<!-- Context: core/navigation-design | Priority: critical | Version: 1.0 | Updated: 2026-04-03 -->

# Navigation Design

**Purpose**: navigation.md requirements for each category

**Last Updated**: 2026-04-03

---

## navigation.md Requirement

<rule id="readme_required" enforcement="strict">
  Every context category MUST have navigation.md at its root with:
  1. Purpose (1-2 sentences)
  2. Navigation tables for each function folder
  3. Priority levels (critical/high/medium/low)
  4. Loading strategy (what to load for common tasks)
</rule>

---

## Required Sections

### Purpose
```
# {Category} Navigation

**Purpose**: [1-2 sentences]
```

### Navigation Tables
```
### Concepts
| File | Description | Priority |
|------|-------------|----------|
```

### Loading Strategy
```
**For {task}**: 
1. Load concepts/x.md
2. Reference guides/y.md if needed
```

---

## Example

```markdown
# Development Context

**Purpose**: Core development patterns, errors, and examples

---

## Quick Navigation

### Concepts
| File | Description | Priority |
|------|-------------|----------|
| auth.md | Authentication patterns | critical |

### Errors
| File | Description | Priority |
|------|-------------|----------|
| frontend.md | Common frontend errors | high |

---

## Loading Strategy

**For auth work**: 
1. Load concepts/auth.md
2. Load examples/jwt.md
```

---

## Validation

- [ ] Purpose is 1-2 sentences?
- [ ] Navigation tables for all folders?
- [ ] Priority levels assigned?
- [ ] Loading strategy documented?

---

## Related

- standards/structure.md - Core structure
- standards/folders.md - Folder purposes
