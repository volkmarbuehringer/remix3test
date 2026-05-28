<!-- Context: core/navigation | Priority: critical | Version: 2.0 | Updated: 2026-04-29 -->

# Context System

**Purpose**: Documentation for the context system architecture and operations

---

## Structure

```
core/context-system/
├── navigation.md (this file)
├── operations/     # How to operate and maintain the context system
│   └── navigation.md
├── standards/      # Templates and standards for context files
│   └── navigation.md
├── guides/         # Step-by-step guides
│   └── navigation.md
├── examples/       # Working examples
│   └── navigation.md
├── lookup/         # Quick reference (empty)
└── errors/         # Common issues (empty)
```

---

## Quick Routes

| Task | Path |
|------|------|
| **Understand context system** | `navigation.md` (this file) |
| **Operations & procedures** | `operations/navigation.md` |
| **Implementation guides** | `guides/navigation.md` |
| **Standards & templates** | `standards/navigation.md` |
| **Examples** | `examples/navigation.md` |

---

## Core Principles

1. **MVI**: Extract only core concepts, reference full docs
2. **Token-Efficient**: Fast loading, less cost (~200-300 tokens per nav file)
3. **Self-Describing**: Filenames tell you what's inside
4. **Specialized Nav**: For cross-cutting concerns

---

## Two Organizing Patterns

### Pattern A: Function-Based (Repository-Specific)
```
category/
├── navigation.md
├── concepts/      # What it is
├── examples/     # Working code
├── guides/       # How to do it
├── lookup/       # Quick reference
└── errors/      # Common issues
```

### Pattern B: Concern-Based (Multi-Technology)
```
category/
├── navigation.md
├── {concern}/            # What you're doing
│   ├── {approach}/       # Then by approach/tech
│   └── {tech}/
```

---

## Quick Commands

| Command | Purpose |
|---------|---------|
| `/context harvest` | Clean summaries → permanent context |
| `/context extract from {source}` | Extract from docs/code |
| `/context organize {category}` | Restructure flat files |
| `/context update for {topic}` | Update for API changes |
| `/context validate` | Check integrity & sizes |

**All operations show preview before executing.**

---

## By Type

**Examples** → `examples/navigation.md` - Working examples of navigation files
**Guides** → `guides/navigation.md` - Step-by-step guides for working with context
**Operations** → `operations/navigation.md` - How to operate and maintain the context system
**Standards** → `standards/navigation.md` - Templates and standards for context files

---

## Related Context

- **Core Navigation** → `../navigation.md`
- **Core Standards** → `../standards/navigation.md`
- **Core System** → `../system/navigation.md`
