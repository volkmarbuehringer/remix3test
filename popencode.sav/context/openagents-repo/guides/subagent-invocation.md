<!-- Context: openagents-repo/guides | Priority: high | Version: 1.1 | Updated: 2026-04-02 -->

# Guide: Subagent Invocation

**Purpose**: How to correctly invoke subagents using the task tool.

## Key Points

- `subagent_type` must match the registered agent name exactly (e.g., `"Task Manager"`, not `"TaskManager"`)
- Check registry for correct names: `cat registry.json | jq -r '.components.subagents[] | "\(.name)"'`
- Common types: `"Task Manager"`, `"Coder Agent"`, `"TestEngineer"`, `"Reviewer"`, `"Documentation"`
- Don't use file paths or kebab-case IDs as subagent_type

## Minimal Example

```javascript
// ✅ Correct - use exact name from registry
task(
  subagent_type="Task Manager",
  description="Break down feature",
  prompt="Instructions..."
)

// ❌ Incorrect - using ID instead of name
task(subagent_type="task-manager", ...)
```

## Available Subagent Types

| Type | Use Case |
|------|----------|
| Task Manager | Task breakdown |
| Coder Agent | Implementation |
| TestEngineer | Test authoring |
| Reviewer | Code review |
| Documentation | Doc generation |

**Reference**: Full guide at `.opencode/context/openagents-repo/guides/subagent-invocation.md`

**Related**: `lookup/commands.md`, `guides/adding-agent.md`