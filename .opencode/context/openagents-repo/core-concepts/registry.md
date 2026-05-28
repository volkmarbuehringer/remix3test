<!-- Context: openagents-repo/core-concepts/registry | Priority: high | Version: 2.0 | Updated: 2026-03-27 -->

# Concept: Registry System

**Core Idea**: Centralized catalog (`registry.json`) tracking all components (agents, subagents, commands, tools, contexts) with auto-detect scanning and dependency resolution.

**Key Points**:
- Location: `registry.json` (root)
- Components: agents, subagents, commands, tools, contexts
- Auto-detect: `./scripts/registry/auto-detect-components.sh --auto-add`
- Validation: `./scripts/registry/validate-registry.sh`
- Dependencies use `type:id` format (e.g., `subagent:coder-agent`)

**Quick Example**:
```json
{
  "id": "frontend-specialist",
  "name": "Frontend Specialist",
  "type": "agent",
  "path": ".opencode/agent/subagents/development/frontend-specialist.md",
  "description": "Expert in Vue, Svelte, modern CSS",
  "category": "development",
  "dependencies": ["subagent:tester"]
}
```

**Commands**:
```bash
./scripts/registry/auto-detect-components.sh --dry-run  # Preview
./scripts/registry/auto-detect-components.sh --auto-add  # Apply
./scripts/registry/validate-registry.sh                  # Validate
```

**Reference**: `guides/updating-registry.md`
