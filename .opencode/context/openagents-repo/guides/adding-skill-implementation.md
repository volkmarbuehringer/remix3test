<!-- Context: openagents-repo/guides | Priority: high | Version: 1.1 | Updated: 2026-05-13 -->

# Guide: OpenCode Skill Implementation

**Prerequisites**: Load `adding-skill-basics.md` first
**Purpose**: CLI implementation, registry, and testing for OpenCode skills

## CLI Implementation

Basic structure for a skill CLI:

```typescript
#!/usr/bin/env ts-node
interface Args { command: string; [key: string]: any }

async function main() {
  const args = parseArgs()
  switch (args.command) {
    case 'command1': await handleCommand1(args); break
    case 'command2': await handleCommand2(args); break
    case 'help': default: showHelp()
  }
}

function parseArgs(): Args {
  const args = process.argv.slice(2)
  return { command: args[0] || 'help', ...parseOptions(args.slice(1)) }
}

function showHelp() {
  console.log(`{Skill Name}\nUsage: npx ts-node scripts/skill-cli.ts <command> [options]\nCommands:\n  command1  Description\n  command2  Description\n  help      Show this help`)
}

main().catch(console.error)
```

## Register in Registry (Optional)

Add to `registry.json` components:

```json
{
  "skills": [{
    "id": "{skill-name}",
    "name": "Skill Name",
    "type": "skill",
    "path": ".opencode/skills/{skill-name}/SKILL.md",
    "description": "Brief description",
    "tags": ["tag1", "tag2"],
    "dependencies": []
  }]
}
```

Add to profiles:
```json
{ "profiles": { "essential": { "components": ["skill:{skill-name}"] } } }
```

## Testing

```bash
# Test help/commands
bash .opencode/skills/{skill-name}/router.sh help
bash .opencode/skills/{skill-name}/router.sh command1 --option value
npx ts-node .opencode/skills/{skill-name}/scripts/skill-cli.ts help

# Test OpenCode integration
# 1. Call skill via OpenCode  2. Verify event hooks  3. Check conversation history  4. Verify output enhancement
```

## Best Practices

- **Keep focused**: One skill = one concern (task manager tracks tasks, not code gen + testing)
- **Clear docs**: Usage examples, documented commands, expected outputs
- **Error handling**: Graceful missing args, helpful messages, input validation
- **Performance**: Efficient algorithms, cache when appropriate, avoid unnecessary file I/O

## Checklist

- [ ] SKILL.md created at `.opencode/skills/{skill-name}/`
- [ ] router.sh created (if CLI-based) and executable (`chmod +x`)
- [ ] Registry updated (if needed)
- [ ] Profile updated (if needed)
- [ ] All commands tested
- [ ] Documentation complete

## Related

- `adding-skill-basics.md` — Directory and SKILL.md setup
- `adding-skill-example.md` — Complete example
- `plugins/context/capabilities/events_skills.md` — Skills Plugin
