<!-- Context: openagents-repo/quick-start | Priority: critical | Version: 1.0 | Updated: 2026-02-15 -->

# OpenAgents Control Repository - Quick Start

**Purpose**: Get oriented in this repo in 2 minutes

---

## What Is This Repo?

OpenAgents Control is an AI agent framework with:
- **Category-based agents** (core, development, content, data, product, learning)
- **Eval framework** for testing agent behavior
- **Registry system** for component distribution
- **Install system** for easy setup

---

## Core Concepts (Load These First)

1. **Agents** → `core-concepts/agents.md` — Structure, categories, prompts, subagents
2. **Evals** → `core-concepts/evals.md` — Testing, evaluators, session collection
3. **Registry** → `core-concepts/registry.md` — Component tracking, auto-detect, validation
4. **Categories** → `core-concepts/categories.md` — Organization, naming, paths

---

## I Need To...

| Task | Load These Files |
|------|------------------|
| Add a new agent | `core-concepts/agents.md` + `guides/adding-agent-basics.md` |
| Test an agent | `core-concepts/evals.md` + `guides/testing-agent.md` |
| Fix registry | `core-concepts/registry.md` + `guides/updating-registry.md` |
| Debug issue | `guides/debugging.md` |
| Find files | `lookup/file-locations.md` |
| Create release | `guides/creating-release.md` |

---

## Essential Paths

```
.opencode/agent/core/              # Core agents (openagent, opencoder)
.opencode/agent/{category}/        # Category agents
.opencode/agent/subagents/         # Subagents
evals/agents/{category}/{agent}/   # Agent tests
registry.json                      # Component catalog
install.sh                         # Installer
.opencode/context/                 # Context files
```

---

## Common Commands

```bash
# Auto-detect new agent
./scripts/registry/auto-detect-components.sh --auto-add
# Validate registry
./scripts/registry/validate-registry.sh
# Test agent
cd evals/framework && npm run eval:sdk -- --agent={category}/{agent}
# Validate test suites
./scripts/validation/validate-test-suites.sh
# Install locally
REGISTRY_URL="file://$(pwd)/registry.json" ./install.sh --list
# Full validation
./scripts/registry/validate-registry.sh && ./scripts/validation/validate-test-suites.sh
```

---

## Quick Troubleshooting

| Problem | Solution |
|---------|----------|
| Registry validation fails | `./scripts/registry/auto-detect-components.sh --auto-add` |
| Test fails | Load `guides/debugging.md` |
| Can't find file | Load `lookup/file-locations.md` |
| Install fails | Check: `which curl jq` |

---

## Next Steps

1. **First time?** → Read `core-concepts/agents.md`, `evals.md`, `registry.md`
2. **Adding agent?** → Load `guides/adding-agent-basics.md`
3. **Testing?** → Load `guides/testing-agent.md`

---

**Last Updated**: 2026-01-13  
**Version**: 0.5.1
