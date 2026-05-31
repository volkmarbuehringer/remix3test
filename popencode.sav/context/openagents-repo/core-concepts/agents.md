<!-- Context: openagents-repo/core-concepts/agents | Priority: critical | Version: 2.0 | Updated: 2026-03-27 -->

# Concept: Agents

**Core Idea**: Agents are AI prompt files (Markdown with YAML frontmatter) that define specialized behaviors, organized by domain, context-aware, and testable via eval framework.

**Key Points**:
- Frontmatter: `description`, `category`, `type`, `tags`, `dependencies`
- Types: main agents (core/), specialist subagents (subagents/)
- Modes: `primary` (direct use), `subagent` (delegated), `all` (both)
- Context loading: Agents reference context files in prompts
- Dependencies: Declare subagents, commands, context files needed

**Quick Example**:
```yaml
---
description: "Frontend development specialist"
mode: subagent
category: development
tags: [css, frontend, web-standards]
dependencies: [subagent:tester]
---

# Frontend Specialist

You specialize in Vue, Svelte, and modern CSS frameworks...
```

**Agent Types**:
- `openagent`: Universal coordination
- `opencoder`: Complex coding & architecture
- `frontend-specialist`, `devops-specialist`: Domain specialists

**Reference**: `core-concepts/categories.md` | `standards/agent-frontmatter.md`
