<!-- Context: core/structure | Priority: critical | Version: 1.1 | Updated: 2026-04-03 -->

# Context Structure

**Purpose**: Function-based folder organization for easy discovery

**Last Updated**: 2026-04-03

---

## Core Structure

<rule id="function_structure" enforcement="strict">
  ALWAYS organize by function (what info does), not just by topic.
  
  Required folders:
  - concepts/  - Core ideas, definitions
  - examples/  - Minimal working code
  - guides/    - Step-by-step workflows
  - lookup/    - Quick reference tables
  - errors/    - Common issues, fixes
</rule>

```
.opencode/context/{category}/
├── navigation.md              # Required
├── concepts/              # What it is
├── examples/              # Working code
├── guides/                # How to do it
├── lookup/                # Quick reference
└── errors/                # Common issues
```

---

## Categorization Rules

| Question | Folder |
|----------|--------|
| Does it explain **what** something is? | `concepts/` |
| Does it show **working code**? | `examples/` |
| Does it explain **how to do** something? | `guides/` |
| Is it **quick reference** data? | `lookup/` |
| Does it document an **error/issue**? | `errors/` |

---

## Anti-Patterns

### ❌ Flat Structure
```
development/
├── authentication.md
├── jwt-example.md
├── setting-up-auth.md
```
**Problem**: Hard to discover purpose

### ✅ Function-Based
```
development/
├── navigation.md
├── concepts/authentication.md
├── examples/jwt-example.md
├── guides/setting-up-auth.md
```
**Benefit**: Instantly know file purpose

---

## Validation

- [ ] All categories have navigation.md?
- [ ] Files in function folders (not flat)?
- [ ] Priority levels assigned?

---

## Related

- standards/folders.md - Folder purposes
- standards/navigation-design.md - navigation.md requirements
- standards/mvi.md - What to extract
