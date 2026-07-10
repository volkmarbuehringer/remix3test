## Context

The top navbar in `app/ui/layout.tsx` has two icon-only buttons:

- **Logout button**: a `<button>` with a close glyph, inside a `<form>`, with `aria-label="Logout"`
- **Theme toggle button**: a `<button>` showing 🌓, with `aria-label="Toggle dark mode"`

Both have accessible labels for screen readers but no visual tooltip. Sighted users must guess or click to discover their purpose.

No existing tooltip pattern exists in the codebase. This is a small, self-contained addition.

## Goals / Non-Goals

**Goals:**

- Add visual tooltip text to the logout button on hover/focus
- Add visual tooltip text to the theme toggle button on hover/focus
- Reuse tooltip styling between both buttons
- Keep the implementation lightweight — pure CSS, no JavaScript

**Non-Goals:**

- Not building a general-purpose tooltip component or system (this is just for these two buttons)
- No animation framework or third-party dependency
- No changes to the existing `aria-label` attributes

## Decisions

| Decision                    | Choice                                                  | Rationale                                                                                                                                                           |
| --------------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Implementation approach** | `data-tooltip` attribute + CSS `::after` pseudo-element | Avoids wrapping elements or JS. The text lives in the attribute, CSS handles appearance. Cleanest separation of concerns.                                           |
| **Positioning**             | Below the icon, centered                                | Below keeps it out of the navbar's tight vertical space. Centered aligns with the icon.                                                                             |
| **Trigger**                 | `:hover` and `:focus-visible`                           | Covers mouse users and keyboard users. No touch delay needed since these are not navigation links.                                                                  |
| **Styling**                 | Dark background, light text, small font, rounded        | Matches standard tooltip conventions. Uses hardcoded colors (not theme tokens) since the tooltip is a small overlay that should be readable against any background. |
| **Delay**                   | 300ms appear, none on disappear                         | Prevents tooltip flash when mouse passes over quickly.                                                                                                              |

**Alternatives considered:**

- **Wrapper `<span>`**: Works but adds DOM nesting. The `data-` attribute approach is simpler.
- **JavaScript tooltip library**: Overkill for two buttons. Pure CSS handles this case perfectly.
- **Reusable tooltip component**: Could be extracted later if more tooltips are needed, but premature for now.

## Risks / Trade-offs

| Risk                                                | Mitigation                                                                  |
| --------------------------------------------------- | --------------------------------------------------------------------------- |
| Tooltip text may overflow on narrow screens         | Cap tooltip `max-width` and wrap text                                       |
| Tooltip may be clipped by navbar overflow           | Ensure navbar has no `overflow: hidden` — it uses flexbox so no clipping    |
| Touch users won't see tooltips (no hover on mobile) | Tooltips are progressive enhancement; `aria-label` already covers all users |
