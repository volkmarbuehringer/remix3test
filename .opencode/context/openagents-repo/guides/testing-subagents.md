<!-- Context: openagents-repo/guides | Priority: high | Version: 1.1 | Updated: 2026-04-12 -->

# Testing Subagents

**Purpose**: Test subagents in standalone mode.

## ⚠️ Critical: Add New Subagent to Framework

Before testing, update THREE locations:

1. `evals/framework/src/sdk/run-sdk-tests.ts` (~line 336): Add to `subagentParentMap`
2. `evals/framework/src/sdk/run-sdk-tests.ts` (~line 414): Add to `subagentPathMap`
3. `evals/framework/src/sdk/test-runner.ts` (~line 238): Add to `agentMap`

If missing: tests fail with "No test files found"

---

## Quick Start

```bash
# Test subagent directly
pnpm --filter @opencode/evals test:subagent contextscout

# Run specific test file
node test-runner.ts --subagent contextscout --test-file tests/contextscout.test.ts
```

---

## Key Points

- **Standalone mode**: Tests subagent in isolation
- **Framework integration**: Requires 3 map updates
- **Test files**: Located in `tests/` directory
- **Run via**: `pnpm test:subagent <name>`

---

## Reference

- Subagent structure: `examples/subagent-prompt-structure.md`
- Framework: `evals/framework/src/sdk/`
