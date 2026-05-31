<!-- Context: openagents-repo/core-concepts/agent-metadata | Priority: critical | Version: 2.0 | Updated: 2026-03-27 -->

# Concept: Agent Metadata System

**Core Idea**: Agent frontmatter contains ONLY valid OpenCode fields. All other metadata (id, name, category, tags, dependencies) lives in centralized `.opencode/config/agent-metadata.json` to prevent OpenCode validation errors.

**Key Points**:
- Valid OpenCode fields: `description`, `mode`, `model`, `temperature`, `maxSteps`, `disable`, `prompt`, `hidden`, `tools`, `permission`
- Metadata file: `.opencode/config/agent-metadata.json` with schema for agents, defaults
- Auto-detect merges frontmatter + metadata into registry.json
- Migration: Move non-OpenCode fields from frontmatter to metadata file

**Quick Example**:
```yaml
# Agent file - ONLY valid OpenCode fields
---
description: "Orchestration agent for complex coding"
mode: primary
temperature: 0.1
tools: { read: true, write: true }
---
```

```json
// agent-metadata.json
{
  "agents": {
    "opencoder": {
      "id": "opencoder",
      "name": "OpenCoder",
      "category": "core",
      "dependencies": ["subagent:coder-agent"]
    }
  }
}
```

**Reference**: https://opencode.ai/docs/agents/
