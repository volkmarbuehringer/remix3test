<!-- Context: core/folders | Priority: high | Version: 1.0 | Updated: 2026-04-03 -->

# Folder Purposes

**Purpose**: Define what each function folder contains

**Last Updated**: 2026-04-03

---

## Folder Types

### concepts/
**Purpose**: Core ideas, definitions, "what is it?"

**Contains**:
- Fundamental concepts
- Design patterns
- Architecture decisions

**Examples**:
- `concepts/authentication.md`
- `concepts/state-management.md`

---

### examples/
**Purpose**: Minimal working code examples

**Contains**:
- Code snippets that work as-is
- Minimal reproductions
- Common patterns in action

**Rule**: Examples <30 lines of code, fully functional

---

### guides/
**Purpose**: Step-by-step workflows, "how to do X"

**Contains**:
- Numbered procedures
- Setup instructions
- Implementation workflows

**Rule**: Steps should be actionable

---

### lookup/
**Purpose**: Quick reference tables, commands, paths

**Contains**:
- Command lists
- File locations
- API endpoints
- Configuration options

**Rule**: Must be in table/list format (scannable)

---

### errors/
**Purpose**: Common errors, gotchas, edge cases

**Contains**:
- Error messages + fixes
- Common pitfalls
- Troubleshooting

**Rule**: Group by framework/topic, not one file per error

---

## Related

- standards/structure.md - Core structure
- standards/navigation-design.md - navigation.md requirements
