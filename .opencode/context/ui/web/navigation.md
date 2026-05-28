<!-- Context: ui/navigation | Priority: critical | Version: 1.1 | Updated: 2026-05-13 -->

# Web UI Context

**Purpose**: Web-based UI patterns, animations, and styling standards (Remix 3 — no React).

> ⚠️ **Project Note**: This project uses Remix 3 (Web Standards-based). No React patterns, hooks, or client-side React patterns should be loaded or referenced.

## Structure

```
ui/web/
├── navigation.md
├── concepts/
│   ├── ui-styling-standards.md   # CSS frameworks, Tailwind patterns [high]
│   └── design-systems.md         # Design system principles [medium]
├── guides/
│   ├── animation-basics.md       # Fundamentals, timing, easing [high]
│   ├── animation-advanced.md     # Recipes, best practices, a11y [medium]
│   ├── animation-loading.md      # Skeleton, spinner, progress [medium]
│   └── animation-forms.md        # Form input/validation animations [medium]
├── examples/
│   ├── animation-components.md   # Button, card, modal animations [high]
│   └── animation-chat.md         # Chat UI and message animations [medium]
├── lookup/
│   └── navigation.md             # Quick reference index (component APIs, tokens)
└── design/
    ├── navigation.md             # Advanced design navigation
    ├── concepts/
    ├── guides/
    └── examples/
```

## Loading Strategy

| Task | Load Sequence |
|------|--------------|
| General web UI | `ui-styling-standards.md` → `animation-basics.md` (if needed) |
| Animation work | `animation-basics.md` → `animation-components.md` → reference others |
| Scroll animations | Navigate to `design/` subcategory |

## Scope

- ✅ CSS animations & transitions
- ✅ Tailwind CSS / utility-first styling
- ✅ Design systems & component libraries
- ✅ Scroll-linked animations (scrollytelling)
- ✅ Canvas-based rendering
- ✅ Framer Motion patterns

## File Summaries

- **Guides** (basics, advanced, loading, forms): CSS animations, micro-interactions, UI transitions — animation micro-syntax, 60fps performance, reduced motion, form animations
- **Examples** (components, chat): Working code for component patterns and chat UI animations
- **Concepts** (styling-standards, design-systems): Utility-first CSS, component styling, design tokens

## Related Categories

- `ui/terminal/` — Terminal UI patterns
- `development/` — General development patterns
- `product/` — Product design and UX strategy

**Used by agents**: frontend-specialist, design-specialist, ui-developer, animation-expert

**Stats**: 8 core files + 1 subcategory (design/)
