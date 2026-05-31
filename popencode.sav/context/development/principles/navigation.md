<!-- Context: development/navigation | Priority: critical | Version: 1.0 | Updated: 2026-02-15 -->

# Development Principles Navigation

**Purpose**: Universal development principles (language-agnostic)

---

## Concepts

All principles are organized as concepts in `concepts/`:

| File | Topic | Priority | Load When |
|------|-------|----------|-----------|
| `concepts/clean-code.md` | Clean code practices | ⭐⭐⭐⭐ | Writing any code |
| `concepts/api-design.md` | API design principles | ⭐⭐⭐⭐ | Designing APIs |
| `concepts/typescript-types.md` | TypeScript type design | ⭐⭐⭐⭐ | Working with .ts/.tsx files |
| `lookup/typescript-types.md` | TypeScript quick ref | ⭐⭐ | Type reminders |

---

## Loading Strategy

**For general development**:
1. Load `concepts/clean-code.md` (high)
2. Also load: `../../core/standards/concepts/code-quality.md` (critical)

**For API development**:
1. Load `concepts/api-design.md` (high)
2. Also load: `../../core/standards/concepts/code-quality.md` (critical)

---

## Scope

**This directory**: Development-specific principles
**Core standards**: Universal standards (all projects, all languages)

| Location | Scope | Examples |
|----------|-------|----------|
| `core/standards/` | **Universal** (all projects) | Code quality, testing, docs, security |
| `development/principles/` | **Development-specific** | Clean code, API design, error handling |

---

## Related

- **Core Standards** → `../../core/standards/navigation.md`
- **Backend Patterns** → `../backend/navigation.md`
- **Frontend Patterns** → `../frontend/navigation.md`
