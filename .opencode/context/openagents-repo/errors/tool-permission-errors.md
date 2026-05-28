<!-- Context: openagents-repo/errors | Priority: medium | Version: 1.1 | Updated: 2026-04-20 -->

# Error: Tool Permission Errors

**Core Idea**: Tool permission denied errors occur when agent has tool disabled/denied in frontmatter, or subagent incorrectly tries to use restricted tools.

**Key Points**:
- `bash: false` or `permission.bash."*": "deny"` blocks tool access
- Subagents should NOT use execution tools (bash/write/edit/task)
- Read-only subagents: enable read tools, disable execution tools
- Tests for subagents should use `auto-approve` strategy

**Quick Fixes**:
```yaml
# Read-only subagent config
tools:
  read: true
  grep: true
  glob: true
  bash: false
  edit: false
  write: false

# Emphasize in prompt
<critical_rules>
  <rule>ONLY use: glob, read, grep, list</rule>
  <rule>NEVER use: bash, write, edit, task</rule>
</critical_rules>
```

**Tool Permission Matrix**:
| Agent Type | bash | write | edit | task | read | grep | glob |
|------------|------|-------|------|------|------|------|------|
| Read-only subagent | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| Primary agent | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

**Related**: `core-concepts/subagent-testing-modes.md`, `guides/testing-subagents.md`