<!-- Context: core/navigation | Priority: critical | Version: 1.0 | Updated: 2026-02-15 -->

# Core Context Navigation

**Purpose**: Universal standards and workflows for all development

---

## Structure

```
core/
├── navigation.md
├── context-system.md
│
├── standards/                    # CONCEPTS (what standards are)
│   ├── navigation.md
│   ├── concepts/
│   │   ├── code-quality.md
│   │   ├── test-coverage.md
│   │   ├── documentation.md
│   │   ├── security-patterns.md
│   │   ├── code-analysis.md
│   │   ├── project-intelligence.md
│   │   └── project-intelligence-management.md
│   └── context-system/concepts/essential-patterns.md
│
├── workflows/                    # GUIDES (how-to workflows)
│   ├── navigation.md
│   ├── guides/
│   │   ├── code-review.md
│   │   ├── task-delegation-basics.md
│   │   ├── feature-breakdown.md
│   │   ├── session-management.md
│   │   ├── visual-development.md
│   │   └── design-iteration-*.md
│   └── guides/
│
├── task-management/              # Already function-based ✓
│   ├── navigation.md
│   ├── concepts/
│   ├── guides/
│   └── lookup/
│
├── system/                       # LOOKUP + GUIDES
│   ├── navigation.md
│   ├── lookup/
│   │   └── context-paths.md
│   └── guides/
│       └── context-guide.md
│
└── context-system/               # Already function-based ✓
    ├── navigation.md
    ├── concepts/
    ├── examples/
    ├── guides/
    ├── lookup/
    └── errors/
```

---

## Quick Routes

| Task | Path |
|------|------|
| **Write code** | `standards/concepts/code-quality.md` |
| **Write tests** | `standards/concepts/test-coverage.md` |
| **Write docs** | `standards/concepts/documentation.md` |
| **Security patterns** | `standards/concepts/security-patterns.md` |
| **Review code** | `workflows/guides/code-review.md` |
| **Delegate task** | `workflows/guides/task-delegation-basics.md` |
| **Break down feature** | `workflows/guides/feature-breakdown.md` |
| **Manage tasks** | `task-management/navigation.md` |
| **Task CLI commands** | `task-management/lookup/task-commands.md` |
| **Context paths** | `system/lookup/context-paths.md` |
| **Context system** | `context-system/navigation.md` |

---

## By Type

**Standards** → Code quality, testing, docs, security (critical priority)
**Workflows** → Review, delegation, task breakdown (high priority)
**Task Management** → JSON-driven task tracking with CLI (high priority)
**System** → Context management and guides (medium priority)

---

## Related Context

- **Development** → `../development/navigation.md`
- **OpenAgents Control Repo** → `../openagents-repo/navigation.md`
