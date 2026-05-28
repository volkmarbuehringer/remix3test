<!-- Context: openagents-repo/lookup | Priority: high | Version: 1.1 | Updated: 2026-04-02 -->

# Lookup: Command Reference

**Purpose**: Quick reference for common commands in the OpenAgents repo.

## Key Points

- Registry validation: `./scripts/registry/validate-registry.sh`
- Auto-detect components: `./scripts/registry/auto-detect-components.sh --auto-add`
- Run tests: `cd evals/framework && npm run eval:sdk -- --agent={category}/{agent}`
- Install: `./install.sh {profile}` (profiles: essential, developer, business, full, advanced)
- Test locally: `REGISTRY_URL="file://$(pwd)/registry.json" ./install.sh --list`

## Quick Workflows

```bash
# Add new agent
touch .opencode/agent/{category}/{agent}.md
./scripts/registry/auto-detect-components.sh --auto-add
./scripts/registry/validate-registry.sh

# Create release
echo "0.X.Y" > VERSION
jq '.version = "0.X.Y"' package.json > tmp && mv tmp package.json
git add VERSION package.json CHANGELOG.md
git commit -m "chore: bump version to 0.X.Y"
git tag -a v0.X.Y -m "Release v0.X.Y"
git push origin main && git push origin v0.X.Y
```

## Common Patterns

```bash
# Find files
find .opencode/agent -name "{agent}.md"
find evals/agents -name "*.yaml"

# Check registry
cat registry.json | jq '.components.agents[].id'
```

**Reference**: Full guide at `.opencode/context/openagents-repo/lookup/commands.md`

**Related**: `lookup/file-locations.md`, `guides/debugging.md`