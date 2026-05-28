<!-- Context: openagents-repo/navigation | Priority: critical | Version: 1.0 | Updated: 2026-02-15 -->

# OpenCode Plugin Context Library

**Purpose**: Structured context for understanding, building, and extending OpenCode plugins

---

## Structure

```
plugins/context/
├── navigation.md (this file)
├── context-overview.md
├── architecture/
│   ├── overview.md
│   └── lifecycle.md
├── capabilities/
│   ├── agents.md
│   ├── events.md
│   ├── events_skills.md
│   └── tools.md
└── reference/
    └── best-practices.md
```

---

## Quick Routes

| Task | Path |
|------|------|
| **Library overview** | `./context-overview.md` |
| **Plugin architecture** | `./architecture/overview.md` |
| **Plugin lifecycle** | `./architecture/lifecycle.md` |
| **Custom agents** | `./capabilities/agents.md` |
| **Plugin events** | `./capabilities/events.md` |
| **Skills event hooks** | `./capabilities/events_skills.md` |
| **Custom tools** | `./capabilities/tools.md` |
| **Best practices** | `./reference/best-practices.md` |
| **Plugins home** | `../navigation.md` |

---

## By Section

**Architecture** → Foundational concepts: registration, context object, lifecycle, packaging, manifest  
**Capabilities** → Deep dives: events system, custom tools (Zod), custom agents, skills plugin hooks  
**Reference** → Guidelines: message injection, security, performance, troubleshooting

---

## Loading Strategy

| Task | Load Order |
|------|-----------|
| New tool | `architecture/overview.md` → `capabilities/tools.md` |
| Event handling | `architecture/overview.md` → `capabilities/events.md` |
| Plugin architecture | `architecture/overview.md` → `architecture/lifecycle.md` |
| Custom agent | `capabilities/agents.md` |

---

## Related Context

- **OpenAgents Navigation** → `../../navigation.md`
- **Plugins** → `../navigation.md`
- **Guides** → `../../guides/navigation.md`
- **Core Concepts** → `../../core-concepts/navigation.md`
