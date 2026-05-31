<!-- Context: openagents-repo/guides | Priority: high | Version: 1.1 | Updated: 2026-04-02 -->

# Guide: Profile Validation

**Purpose**: Ensure installation profiles include all appropriate components when adding new agents.

## Key Points

- New agents added to `components.agents[]` but NOT added to profiles = users won't get them
- Development agents → developer, full, advanced profiles
- Content agents → business, full, advanced profiles  
- Meta agents → advanced profile only
- Core agents → essential + all profiles

## Quick Validation

```bash
# Check agent in components
cat registry.json | jq '.components.agents[] | select(.id == "your-agent")'

# Check agent in profile
cat registry.json | jq '.profiles.developer.components[] | select(. == "agent:your-agent")'
```

## Profile Assignment

| Category | Essential | Developer | Business | Full | Advanced |
|----------|-----------|-----------|----------|------|----------|
| core     | ✅        | ✅        | ✅       | ✅   | ✅       |
| development | ❌    | ✅        | ❌       | ✅   | ✅       |
| content  | ❌        | ❌        | ✅       | ✅   | ✅       |
| meta     | ❌        | ❌        | ❌       | ❌   | ✅       |

**Reference**: Full guide at `.opencode/context/openagents-repo/guides/profile-validation.md`

**Related**: `core-concepts/registry.md`, `guides/updating-registry.md`