## Context

The app defines its own theme in `app/theme.tsx` using `createTheme` from `remix/ui/theme`. The surface level values (`lvl0`–`lvl4`) are inverted — `lvl0` is darkest (`#dee2e6`) and `lvl4` is lightest (`#f7fbff`). The RMX_01 convention (and the semantic naming) treats `lvl0` as the highest-elevation surface (cards, modals) and `lvl4` as the deepest (subtle backgrounds). This means raised UI elements like cards, panels, and modals appear darker than their surroundings, which is visually backwards.

The app also has 42 hardcoded inline SVGs and 5 emoji/text characters used as icons across layouts, navigation, and action buttons. The library provides a `Glyph` component (`remix/ui/glyph`) with 17 named icons (add, alert, check, chevronDown, chevronUp, chevronRight, chevronVertical, close, copy, edit, expand, info, menu, open, search, spinner, trash) using an SVG sprite pattern. This gives consistent sizing, theming via `currentColor`, and built-in accessibility.

## Goals / Non-Goals

**Goals:**
- Correct the surface level value ordering so `lvl0` = lightest/elevated and `lvl4` = darkest/deepest, matching RMX_01 semantics
- Replace hardcoded SVGs and emoji icons with `Glyph` components in the most visible, high-traffic areas
- Maintain identical dark mode behavior (just with corrected values)
- Keep all existing component structure — this is purely value and markup changes

**Non-Goals:**
- Replacing every single inline SVG in one pass — scoped to ~15 most impactful files
- Changing the base font (JetBrains Mono stays)
- Adding new glyphs to the library — only using what already exists
- Any routing, data, or controller changes

## Decisions

### Decision 1: Surface level values — invert with careful mapping

Current → Target (light mode):
```
lvl0: #dee2e6  →  #f7fbff  (lightest, elevated)
lvl1: #e8ecf0  →  #f0f4f7  
lvl2: #eef2f6  →  #eef2f6  (stays same — middle value)
lvl3: #f0f4f7  →  #e8ecf0
lvl4: #f7fbff  →  #dee2e6  (darkest, deepest)
```

This is a straight reversal of the value-to-level mapping. `lvl2` stays the same since it's the midpoint.

**Alternative considered**: Keeping values and just changing which components use which level. Rejected because it would require auditing every `theme.surface.lvlX` reference and inverting usage — more error-prone and harder to review than a single values change.

### Decision 2: Glyph adoption — use the RMX_01 glyph set verbatim

The RMX_01 preset includes 17 glyphs that cover the vast majority of the icons used in the app (chevrons, close, check, trash, edit, search, etc.). For icons without a direct glyph match (e.g., the ChatGPT-style sparkle icon in agent page), inline SVGs stay in place.

**Mapping of current icons to glyph names:**

| Current Icon | Location | Glyph Name |
|---|---|---|
| Logout arrow (door) | `layout.tsx` nav | `close` (or keep inline — no direct match) |
| 🌓 emoji | `layout.tsx` theme toggle | Use sun/moon: leave as emoji toggle or add basic CSS toggle |
| Chat bubble | `chat-page.tsx` | `menu` (generic) or keep inline |
| Sparkle/send | `chat-page.tsx` | Inline (no match) |
| Admin nav icons | `admin-layout.tsx` | Replace with glyph equivalents |
| AI nav icons | `ai-layout.tsx` | Replace with glyph equivalents |
| ✓ / ✕ buttons | `lists-client.tsx` | `check` / `close` |
| Select arrows | `workflow-page.tsx` | `chevronDown`, `chevronUp` |
| Copy icon | `prompt-button.tsx` | `copy` |
| Edit/pencil | `workflow-page.tsx` | `edit` |
| Trash | `workflow-page.tsx` | `trash` |

### Decision 3: Add `RMX_01_GLYPHS` to document shell

The `Glyph` component uses an SVG sprite that must be rendered in the document. Currently `app/ui/document.tsx` renders `<RMX_01 />` but NOT `<RMX_01_GLYPHS />`. The glyph sheet needs to be added for the `Glyph` component to resolve icon references.

**Alternative considered**: Creating a custom glyph sheet. Rejected — RMX_01's glyphs cover enough of the icon surface to start, and custom additions can be made later.

## Risks / Trade-offs

- **[Visual regression]** Fixing surface levels will change the background color of every card, panel, and page section. Mitigation: Values shift gradually — the contrast ladder stays consistent, just the elevation semantics are corrected.
- **[Missing glyph]** Some icons (sparkle/send AI icons) have no glyph equivalent. Mitigation: Inline SVGs stay for those; the change targets only icons with clear glyph matches.
- **[Glyph sprite overhead]** Adding `RMX_01_GLYPHS` adds ~3KB of SVG definitions to every page. Mitigation: The sprite is static, cacheable, and replaces larger inline SVGs, so net size likely decreases.
- **[Incomplete pass]** With 42 inline SVGs, the scoped replacement may leave some files inconsistent. Mitigation: The task list explicitly notes unscoped files for future follow-up.
