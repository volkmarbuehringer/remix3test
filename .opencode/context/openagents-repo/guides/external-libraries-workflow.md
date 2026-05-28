<!-- Context: openagents-repo/guides/external-libraries-workflow | Priority: high | Version: 1.0 | Updated: 2026-01-29 -->
# Guide: External Libraries Workflow

**Purpose**: Fetch current documentation for external packages when adding agents or skills

**When to Use**: Any time you're working with external libraries (Drizzle, Better Auth, Next.js, etc.)

---

## Quick Start

**Golden Rule**: NEVER rely on training data for external libraries → ALWAYS fetch current docs

**Process**:
1. Detect external package in your task
2. Check for install scripts (if first-time setup)
3. Use **ExternalScout** to fetch current documentation
4. Implement with fresh, version-specific knowledge

---

## When to Use ExternalScout (MANDATORY)

✅ **Use ExternalScout when**:
- Adding new agents that depend on external packages
- Adding new skills that integrate with external libraries
- First-time package setup in your implementation
- Package/dependency errors occur
- Version upgrades are needed
- ANY external library work

❌ **Don't rely on**:
- Training data (outdated, often wrong)
- Old documentation (APIs change)
- Assumptions about package behavior

---

## Workflow Steps

### Step 1: Detect External Package

**Triggers**:
- User mentions a library name
- You see imports in code
- package.json has new dependencies
- Build errors reference external packages

### Step 2: Check Install Scripts (First-Time Only)

```bash
# Look for install scripts
ls scripts/install/ scripts/setup/ bin/install* setup.sh install.sh
```

If scripts exist → Read them to understand setup order, environment variables, prerequisites.

### Step 3: Fetch Current Documentation (MANDATORY)

```bash
task(
  subagent_type="ExternalScout",
  description="Fetch {Library} documentation",
  prompt="Fetch current documentation for {Library} focusing on:
          - Setup requirements
          - Integration patterns
          - Version-specific features"
)
```

### Step 4: Implement with Fresh Knowledge

- Follow current best practices from ExternalScout docs
- Use version-specific APIs
- Reference the fetched docs in code comments

---

## Integration with Agent/Skill Creation

### When Adding an Agent
1. Read: `guides/adding-agent.md`
2. **If agent uses external packages**: Use ExternalScout to fetch docs
3. Document dependencies in agent metadata
4. Add to registry with correct versions
5. Test: `guides/testing-agent.md`

### When Adding a Skill
1. Read: `guides/adding-skill.md`
2. **If skill uses external packages**: Use ExternalScout to fetch docs
3. Document dependencies in skill metadata
4. Add to registry with correct versions
5. Test: `guides/testing-subagents.md`

---

## Checklist

Before implementing with external libraries:
- [ ] Identified all external packages involved
- [ ] Checked for install scripts (if first-time)
- [ ] Used ExternalScout to fetch current docs
- [ ] Reviewed version-specific features
- [ ] Documented dependencies in metadata
- [ ] Tested implementation thoroughly

---

## Related

- `lookup/external-libraries-reference.md` - Common packages in OpenAgents
- `guides/adding-agent.md` - Creating new agents
- `guides/adding-skill.md` - Creating new skills
- `guides/debugging.md` - Troubleshooting

> **Key Principle**: External libraries change constantly. Always fetch current documentation before implementing.
