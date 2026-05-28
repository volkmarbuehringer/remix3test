<!-- Context: project-intelligence/nav | Priority: high | Version: 1.5 | Updated: 2026-05-01 -->

# Project Intelligence

> Start here for quick project understanding. These files bridge business and technical domains.

## Structure

```
project-intelligence/
├── concepts/          # Business domain, technical domain, bridge
├── lookup/            # Decisions log
├── guides/            # Living notes
├── examples/          # Bookstore demo
├── bookstore/         # Remix 3 bookstore context
├── sse/               # SSE demo (function-based ✓)
├── frame-navigation/  # Frame navigation demo (function-based ✓)
├── frames/            # Frame implementation issues
├── my_app/            # Remix 3 app with auth
├── newapp/            # Remix 3 scaffolded app (custom theme, mixins, nav registry)
└── checker/           # Login system patterns
```

## Quick Routes

| What You Need | File/Folder | Description |
|---|---|---|
| Understand the "why" | concepts/business-domain.md | Problem, users, value proposition |
| Understand the "how" | concepts/technical-domain.md | Stack, architecture, integrations |
| See the connection | concepts/business-tech-bridge.md | Business → technical mapping |
| Know the context | lookup/decisions-log.md | Why decisions were made |
| Current state | guides/living-notes.md | Active issues and open questions |
| Bookstore demo | examples/bookstore-demo.md | CRUD, pagination, a11y, tests |
| Bookstore app | bookstore/ | Remix 3 bookstore context and fixes |
| SSE demo | sse/ | Offline messaging, E2E encryption |
| Frame nav demo | frame-navigation/ | Admin patterns, accessibility |
| My App | my_app/ | Auth routes, middleware, controller conventions |
| Checker login | checker/ | Session auth, middleware patterns |
| **Newapp (new)** | **newapp/** | Custom theme, namespace mixins, nav registry, client lab route, admin CRUD (offerings, appointments) |
| Frame issues | frames/errors/nested-frames-errors.md | All nested frames issues |
| Frame architecture | frames/guides/nested-frames.md | Nested Frames /books1 guide |
| Frame patterns | frames/navigation.md | All Frame patterns and guides |

## Usage

**New Team Member / Agent**:
1. Start with `navigation.md` (this file)
2. Read all files in order for complete understanding

**Quick Reference**:
- Business focus → `concepts/business-domain.md`
- Technical focus → `concepts/technical-domain.md`
- Decision context → `lookup/decisions-log.md`

## Integration

Referenced from:
- `core/standards/concepts/project-intelligence.md`
- `core/system/guides/context-guide.md`
- `core/context-system/navigation.md`

## Maintenance

- Update when business direction changes
- Document decisions as they're made
- Review `guides/living-notes.md` regularly

**Management Guide**: `core/standards/concepts/project-intelligence-management.md`
