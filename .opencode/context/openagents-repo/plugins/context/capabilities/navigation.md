<!-- Context: openagents-repo/navigation | Priority: critical | Version: 1.0 | Updated: 2026-02-15 -->

# Plugin Capabilities

**Purpose**: Deep dives into specific OpenCode plugin features — events, tools, agents, and skills hooks

---

## Structure

```
capabilities/
├── navigation.md (this file)
├── agents.md
├── events.md
├── events_skills.md
└── tools.md
```

---

## Quick Routes

| Task | Path |
|------|------|
| **Custom agents** | `./agents.md` |
| **Plugin events (25+)** | `./events.md` |
| **Skills plugin event hooks** | `./events_skills.md` |
| **Custom tools (Zod)** | `./tools.md` |
| **Context library** | `../navigation.md` |

---

## By Type

**Agents** → Creating and configuring custom AI agents with specific roles and toolsets  
**Events** → Complete list of 25+ hookable lifecycle events  
**Events: Skills Plugin** → Practical example using `tool.execute.before`/`after` hooks  
**Tools** → Building custom tools with Zod schema validation

---

## Related Context

- **Plugin Context Library** → `../navigation.md`
- **Architecture** → `../architecture/navigation.md`
- **Reference** → `../reference/navigation.md`
- **Plugins** → `../../navigation.md`
