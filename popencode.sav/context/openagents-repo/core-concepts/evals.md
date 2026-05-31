<!-- Context: openagents-repo/core-concepts/evals | Priority: high | Version: 2.0 | Updated: 2026-03-27 -->

# Concept: Eval Framework

**Core Idea**: TypeScript-based testing system that validates agent behavior through test definitions (YAML), session collection, and evaluator rules that check for violations.

**Key Points**:
- Test location: `evals/agents/{category}/{agent}/tests/*.yaml`
- Evaluators: approval_gate, context_loading, tool_usage, stop_on_failure, execution_balance
- Session stored in `.tmp/sessions/{session-id}/` with events.json timeline
- Run: `npm run eval:sdk -- --agent={category}/{agent}`

**Quick Example**:
```yaml
# Test file
name: Approval Gate Test
agent: core/opencoder
conversation:
  - role: user
    content: "Create a file"
expectations:
  - type: specific_evaluator
    evaluator: approval_gate
    should_pass: true
```

**Commands**:
```bash
cd evals/framework
npm run eval:sdk -- --agent=core/opencoder           # Run all tests
npm run eval:sdk -- --agent=core/opencoder --pattern="smoke*"  # Specific test
npm run eval:sdk -- --agent=core/opencoder --debug   # Debug mode
```

**Reference**: `guides/testing-agent.md`
