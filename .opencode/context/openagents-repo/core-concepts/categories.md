<!-- Context: openagents-repo/core-concepts/categories | Priority: high | Version: 2.0 | Updated: 2026-03-27 -->

# Concept: Category System

**Core Idea**: Domain-based groupings that organize agents, context files, and tests by expertise area for scalability, discovery, and modularity.

**Key Points**:
- Categories: core, development, content, data, product, learning
- Structure: `.opencode/agent/{category}/`, `.opencode/context/{category}/`
- Each category needs `0-category.json` metadata
- Naming: lowercase, singular, kebab-case for files
- Backward compatible: `openagent` → `core/openagent`

**Category Structure**:
```bash
.opencode/
├── agent/
│   ├── core/           # System agents
│   ├── subagents/      # Specialist subagents
│   └── content/        # Content agents
└── context/
    ├── core/           # Core context
    └── development/    # Dev context
```

**Adding a Category**:
```bash
mkdir -p .opencode/agent/{category}
mkdir -p .opencode/context/{category}
# Add 0-category.json metadata
./scripts/registry/auto-detect-components.sh --auto-add
```

**Reference**: `guides/adding-agent.md`
