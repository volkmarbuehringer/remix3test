<!-- Context: openagents-repo/guides | Priority: high | Version: 1.1 | Updated: 2026-04-02 -->

# Guide: Testing an Agent

**Purpose**: Step-by-step workflow for testing agents using the eval framework.

## Key Points

- **Run tests**: `cd evals/framework && npm run eval:sdk -- --agent={category}/{agent}`
- **Smoke test**: Basic functionality check (`--pattern="smoke-test.yaml"`)
- **Debug**: Run with `--debug` to see session details
- **Test types**: Smoke, Approval Gate, Context Loading, Tool Usage

## Test Types

```yaml
# Smoke Test - basic functionality
name: Smoke Test
expectations:
  - type: no_violations

# Approval Gate - verify agent requests approval
expectations:
  - type: specific_evaluator
    evaluator: approval_gate
    should_pass: true

# Context Loading - verify required context loaded
expectations:
  - type: context_loaded
    contexts: ["core/standards/code-quality.md"]

# Tool Usage - verify correct tools used
expectations:
  - type: tool_usage
    tools: ["read"]
    min_count: 1
```

## Quick Start

```bash
# Single test
npm run eval:sdk -- --agent={agent} --pattern="{test}.yaml"

# All tests for agent
npm run eval:sdk -- --agent={agent}

# With debug
npm run eval:sdk -- --agent={agent} --debug
```

## Debugging

```bash
# Find recent session
ls -lt .tmp/sessions/ | head -5

# View session
cat .tmp/sessions/{session-id}/session.json | jq

# View events
cat .tmp/sessions/{session-id}/events.json | jq
```

**Reference**: Full guide at `.opencode/context/openagents-repo/guides/testing-agent.md`

**Related**: `core-concepts/evals.md`, `guides/debugging.md`