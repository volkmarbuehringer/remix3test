<!-- Context: openagents-repo/guides/updating-registry | Priority: high | Version: 2.0 | Updated: 2026-03-27 -->

# Guide: Updating Registry

**Prerequisites**: Load `core-concepts/registry.md` first

**Core Idea**: Use auto-detect to automatically update registry from component frontmatter - preferred over manual edits.

**Key Points**:
- Add tags/dependencies to frontmatter, NOT directly in registry.json
- Run auto-detect to extract and apply metadata
- Always validate after changes
- Use `--dry-run` first to preview

**Quick Example**:
```bash
# 1. Create component with frontmatter
# .opencode/command/my-command.md
---
description: My command
tags: [automation, workflow]
dependencies: [subagent:coder-agent]
---

# 2. Preview changes
./scripts/registry/auto-detect-components.sh --dry-run

# 3. Apply
./scripts/registry/auto-detect-components.sh --auto-add

# 4. Validate
./scripts/registry/validate-registry.sh
```

**Dependency Format**: `type:id`
- `subagent:coder-agent`
- `context:core/standards/code`
- `command:context`

**Reference**: `core-concepts/registry.md`
