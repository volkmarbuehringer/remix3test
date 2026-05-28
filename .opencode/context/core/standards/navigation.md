<!-- Context: core/navigation | Priority: critical | Version: 1.0 | Updated: 2026-02-15 -->

# Core Standards Navigation

**Purpose**: Universal standards for all development work

---

## Concepts

All standards are organized as concepts in `concepts/`:

| File | Topic | Priority | Load When |
|------|-------|----------|-----------|
| `concepts/code-quality.md` | Code quality rules | ⭐⭐⭐⭐⭐ | Writing/reviewing code |
| `concepts/test-coverage.md` | Testing standards | ⭐⭐⭐⭐⭐ | Writing tests |
| `concepts/documentation.md` | Documentation rules | ⭐⭐⭐⭐ | Writing docs |
| `concepts/security-patterns.md` | Security best practices | ⭐⭐⭐⭐ | Security review, patterns |
| `concepts/project-intelligence.md` | What and why | ⭐⭐⭐⭐ | Onboarding, understanding projects |
| `concepts/project-intelligence-management.md` | How to manage | ⭐⭐⭐ | Managing intelligence files |
| `concepts/code-analysis.md` | Analysis approaches | ⭐⭐⭐ | Analyzing code, debugging |

---

## Loading Strategy

**For code implementation**:
1. Load `concepts/code-quality.md` (critical)
2. Load `concepts/security-patterns.md` (high)

**For testing**:
1. Load `concepts/test-coverage.md` (critical)
2. Depends on: `concepts/code-quality.md`

**For documentation**:
1. Load `concepts/documentation.md` (critical)

**For code review**:
1. Load `concepts/code-quality.md` (critical)
2. Load `concepts/security-patterns.md` (high)
3. Load `concepts/test-coverage.md` (high)

**For project onboarding/understanding**:
1. Load `concepts/project-intelligence.md` (high)
2. Then load: `../../project-intelligence/` folder for full project context

---

## Related

- **Workflows** → `../workflows/navigation.md`
- **Development Principles** → `../../development/principles/`
- **Project Intelligence** → `../../project-intelligence/navigation.md` (full project context)
