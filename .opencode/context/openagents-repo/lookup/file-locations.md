<!-- Context: openagents-repo/lookup | Priority: high | Version: 1.1 | Updated: 2026-04-02 -->

# Lookup: File Locations

**Purpose**: Quick reference for finding files in the OpenAgents repo.

## Key Locations

| Component | Location |
|-----------|----------|
| Core agents | `.opencode/agent/core/` |
| Category agents | `.opencode/agent/{category}/` |
| Subagents | `.opencode/agent/subagents/` |
| Context files | `.opencode/context/` |
| Agent tests | `evals/agents/{category}/{agent}/` |
| Eval framework | `evals/framework/src/` |
| Registry scripts | `scripts/registry/` |
| Validation scripts | `scripts/validation/` |
| Registry | `registry.json` |
| Version | `VERSION` |

## Path Patterns

```
.opencode/agent/{category}/{agent-name}.md
.opencode/context/{category}/{topic}.md
evals/agents/{category}/{agent-name}/
  ├── config/config.yaml
  └── tests/{test-name}.yaml
scripts/{purpose}/{action}-{target}.sh
```

## Quick Lookups

```bash
# Find agent
find .opencode/agent -name "{agent}.md"

# Find test
find evals/agents -name "*.yaml"

# Find context
find .opencode/context -name "*.md"

# All agents
cat registry.json | jq '.components.agents[].id'
```

**Reference**: Full guide at `.opencode/context/openagents-repo/lookup/file-locations.md`

**Related**: `lookup/commands.md`, `core-concepts/categories.md`