<!-- Context: development/my_app | Priority: high | Version: 1.0 | Updated: 2026-05-06 -->

# My App Development Context

**Purpose**: Domain-specific patterns and implementations unique to the `my_app` Remix 3 project.

---

## Structure

```
my_app/
├── navigation.md
└── guides/         # How-to: component patterns, migrations, domain logic
    └── client-entry-patterns.md
```

---

## Quick Reference

| File | Type | Description |
|------|------|-------------|
| [client-entry-patterns.md](./guides/client-entry-patterns.md) | Guide | clientEntry implementations, anti-patterns, SSR limits |

---

## When to Use This Context

| Situation | Load This |
|-----------|-----------|
| Adding a new clientEntry component | `guides/client-entry-patterns.md` |
| Debugging a clientEntry issue | `guides/client-entry-patterns.md` + `../../../remix3/errors/client-entry-issues.md` |
| Deciding inline vs clientEntry | `guides/client-entry-patterns.md` + `../../../remix3/ui/guides/client-interactivity-patterns.md` |
| Working on theme/scroll/forms | `guides/client-entry-patterns.md` |
| Understanding SSR limits | `guides/client-entry-patterns.md` |

---

## Related Context

- **Remix 3 clientEntry patterns** → `../remix3/ui/guides/client-entry-side-effects.md` — general side-effect-only pattern
- **Remix 3 interactivity** → `../remix3/ui/guides/client-interactivity-patterns.md` — inline vs clientEntry decision guide
- **Remix 3 clientEntry errors** → `../remix3/errors/client-entry-issues.md` — common problems
- **my_app UI components** → `../../project-intelligence/my_app/guides/ui-component-patterns.md` — component inventory
- **my_app inline script limits** → `../../project-intelligence/my_app/errors/inline-script-limitations.md` — when inline scripts fail

