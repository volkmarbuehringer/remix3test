<!-- Context: openagents-repo/navigation | Priority: critical | Version: 1.0 | Updated: 2026-02-15 -->

# OpenAgents Control Repository Context

**Purpose**: Context files specific to the OpenAgents Control repository

---

## Core Concepts
- `core-concepts/subagent-testing-modes.md` — Standalone vs delegation testing

## Examples (Working Code)
- `examples/subagent-prompt-structure.md` — Optimized subagent prompt template

## Guides (Step-by-Step)
- `guides/testing-subagents.md` — How to test subagents standalone
- `guides/adding-agent-basics.md` — How to add new agents (basics)
- `guides/adding-agent-testing.md` — How to add agent tests
- `guides/adding-skill-basics.md` — How to add OpenCode skills
- `guides/testing-agent.md` — How to test agents
- `guides/external-libraries-workflow.md` — How to handle external library dependencies
- `guides/github-issues-workflow.md` — How to work with GitHub issues and project board
- `guides/npm-publishing.md` — How to publish package to npm
- `guides/updating-registry.md` — How to update registry
- `guides/debugging.md` — How to debug issues
- `guides/resolving-installer-wildcard-failures.md` — Fix wildcard context install failures
- `guides/creating-release.md` — How to create releases

## Lookup (Quick Reference)
- `lookup/subagent-test-commands.md` — Subagent testing commands
- `lookup/external-libraries-reference.md` — External packages reference
- `lookup/file-locations.md` — Where files are located
- `lookup/commands.md` — Available slash commands

## Errors (Troubleshooting)
- `errors/tool-permission-errors.md` — Tool permission issues

## Core Concepts (Foundational)
- `core-concepts/agents.md` — How agents work
- `core-concepts/evals.md` — How testing works
- `core-concepts/registry.md` — How registry works
- `core-concepts/categories.md` — How organization works

## Loading Strategy

| Task | Load Order |
|------|-----------|
| Subagent Testing | `core-concepts/subagent-testing-modes.md` → `guides/testing-subagents.md` |
| Agent Creation | `core-concepts/agents.md` → `guides/adding-agent-basics.md` |
| Debugging | `guides/debugging.md` → relevant `errors/` file |

## Related Context
- `../core/` — Core system context (standards, patterns)
- `../core/context-system/` — Context management system
- `quick-start.md` — 2-minute repo orientation
- `plugins/context/navigation.md` — Plugin system context

## Contributing

When adding new context files:
1. Follow MVI principle
2. Use function-based organization (concepts/, examples/, guides/, lookup/, errors/)
3. Update this navigation and add cross-references
4. Validate with `/context validate`
