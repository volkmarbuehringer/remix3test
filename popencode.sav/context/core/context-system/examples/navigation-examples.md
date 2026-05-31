<!-- Context: core/navigation-examples | Priority: high | Version: 2.0 | Updated: 2026-03-26 -->

# Navigation File Examples

**Core Concept**: Good navigation files are token-efficient (200-300), scannable with ASCII trees and tables, and task-focused with quick routes.

**Last Updated**: 2026-03-26

---

## Template Structure

```markdown
# {Category} Navigation

**Purpose**: {1-2 sentences}

---

## Structure
```

{category}/
├── navigation.md
├── concepts/
├── examples/
├── guides/
├── lookup/
└── errors/

````

## Quick Routes

| Task | Path |
|------|------|
| **New here** | `concepts/intro.md` |
| **Add feature** | `guides/adding.md` |
| **Common errors** | `errors/fixes.md` |

---

## Key Patterns

### ✅ Good Navigation Files
1. **Token-efficient**: 200-300 tokens (~50 lines)
2. **Scannable**: ASCII tree + tables
3. **Task-focused**: Quick routes for common tasks
4. **Organized**: By function (concepts/errors/guides)

### ❌ Bad Navigation Files
1. **Verbose**: 500+ tokens of explanation
2. **Hard to scan**: Paragraphs instead of tables
3. **Unfocused**: No clear quick routes
4. **Detailed**: Duplicates content instead of referencing

---

## Minimal Example

```markdown
# API Development Navigation

**Purpose**: REST API patterns and implementation

---

## Structure

````

api/
├── concepts/
│ └── rest-principles.md
├── guides/
│ └── building-apis.md
└── errors/
└── common-errors.md

```

## Quick Routes

| Task | Path |
|------|------|
| **REST concepts** | `concepts/rest-principles.md` |
| **Build API** | `guides/building-apis.md` |
| **Fix errors** | `errors/common-errors.md` |
```

---

## Anti-Patterns

### ❌ Too Verbose

> "This comprehensive navigation file is designed to help you navigate..."

**Problem**: 800+ tokens, hard to scan

### ❌ Missing Structure

> "Here are the files: clean-code.md, api-design.md..."

**Problem**: No hierarchy, just a list

### ❌ Too Detailed

> "## Vue Patterns
> Vue composition allows you to use state..."

**Problem**: Contains full content instead of referencing

---

## Reference

- Full examples: `guides/navigation-design.md`
- Structure rules: `standards/structure.md`
- MVI principle: `standards/mvi.md`
