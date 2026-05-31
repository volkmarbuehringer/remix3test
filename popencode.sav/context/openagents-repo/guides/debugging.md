<!-- Context: openagents-repo/guides | Priority: high | Version: 1.1 | Updated: 2026-04-02 -->

# Guide: Debugging Common Issues

**Purpose**: Troubleshooting guide for common problems in the OpenAgents repo.

## Key Points

- Run diagnostics: `./scripts/registry/validate-registry.sh && ./scripts/validation/validate-test-suites.sh`
- Check version: `cat VERSION && cat package.json | jq '.version'`
- Session debug: `cat .tmp/sessions/{session-id}/session.json | jq`

## Common Issues & Fixes

| Issue | Diagnosis | Solution |
|-------|-----------|----------|
| Registry validation fails | `./scripts/registry/validate-registry.sh -v` | Remove entry or create file |
| Component not in registry | Check frontmatter | Add frontmatter + auto-detect |
| Approval Gate violation | Run with `--debug` | Add approval request in prompt |
| Context Loading violation | Check events.json | Load required context before code |
| Tool Usage violation | Check tool calls | Use `read` not `bash cat` |
| Version mismatch | Compare VERSION, package.json | Update to same version |

## Quick Workflows

```bash
# Full system check
./scripts/registry/validate-registry.sh -v
./scripts/validation/validate-test-suites.sh
cd evals/framework && npm run eval:sdk

# Reset and rebuild
./scripts/registry/auto-detect-components.sh --auto-add --force
./scripts/registry/validate-registry.sh
```

**Reference**: Full guide at `.opencode/context/openagents-repo/guides/debugging.md`

**Related**: `guides/testing-agent.md`, `guides/updating-registry.md`