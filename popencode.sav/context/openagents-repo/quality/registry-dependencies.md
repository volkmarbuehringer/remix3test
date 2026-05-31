<!-- Context: openagents-repo/quality/registry-dependencies | Priority: high | Version: 2.0 | Updated: 2026-03-27 -->

# Concept: Registry Dependency Validation

**Core Idea**: All component dependencies must be declared in frontmatter using `type:id` format and validated before commits to maintain registry integrity.

**Key Points**:
- Dependency types: `agent:`, `subagent:`, `command:`, `tool:`, `plugin:`, `context:`, `config:`
- Context deps: `context:core/standards/code` → `.opencode/context/core/standards/code-quality.md`
- Use `/check-context-deps` to find missing declarations
- Use `--fix` flag to auto-add missing dependencies
- Validate with `./scripts/registry/validate-registry.sh`

**Quick Example**:
```yaml
# In agent frontmatter
dependencies:
  - subagent:coder-agent      # Delegates to coder-agent
  - context:core/standards/code  # Requires code standards
  - command:context           # Uses context command
```

**Commands**:
```bash
/check-context-deps                     # Find missing deps
/check-context-deps --fix               # Auto-fix
./scripts/registry/validate-registry.sh  # Validate registry
```

**Reference**: `guides/updating-registry.md`
