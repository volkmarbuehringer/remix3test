## Context

The settings page at `app/actions/settings/controller.tsx` uses custom CSS mixins (from `remix/ui`'s `css()` function) defined at the bottom of the file. The page stacks four `<div mix={panelCss}>` sections vertically inside a `<PageSection>` (16px gap). The "Konto löschen" panel uses `deletePanelCss` which adds an extra 24px `marginTop` on top of the section gap, creating 40px between the password section and the delete section — disproportionate for the delete panel's sparse content.

The `css()` function supports `@media` queries (already used in `main-nav.tsx`, `workflow-page.tsx`, etc.), so responsive overrides are possible without a separate stylesheet.

## Goals / Non-Goals

**Goals:**
- Eliminate excess vertical whitespace above the delete account panel on every viewport
- Tighter padding and internal spacing for the delete account panel across all viewports
- Additional mobile-specific tightening (≤768px) for the delete section and overall page feel
- Keep all interactive elements comfortably tappable on mobile

**Non-Goals:**
- No layout restructuring (panels stay stacked vertically)
- No changes to the password change panel or profile panel content
- No changes to controller logic, data flow, or tests
- No introduction of a separate CSS file or CSS framework

## Decisions

1. **Remove `marginTop` from `deletePanelCss` entirely** — the 16px section gap from `<PageSection>` provides adequate visual separation. The extra 24px was redundant and is the single largest source of excess space.

2. **Reduce `deletePanelCss` padding universally** — Change `padding` from `theme.space.lg` (16px) to `theme.space.md` (12px) for all viewports. The delete panel has the sparsest content (one input, one checkbox, one button), so it benefits most from tighter padding everywhere.

3. **Mobile-responsive form gap** — Add a `deleteFormCss` mixin that uses `theme.space.sm` (8px) grid gap via `@media (max-width: 768px)`, while keeping `theme.space.md` (12px) on desktop. This ensures the delete form doesn't feel cramped on wide screens.

4. **Reduce `warningTextCss` margin** — Change `marginBottom` from `theme.space.md` (12px) to `theme.space.sm` (8px) universally, matching the tighter padding scale.

5. **Mobile consistency pass** — Add `@media (max-width: 768px)` to the local `submitButton` constant to reduce vertical padding from 12px to 8px on mobile, keeping all action buttons visually balanced with the tighter delete section.

## Risks / Trade-offs

- **Tightness vs. touch targets** — Reducing padding/gaps on mobile must not make interactive elements too cramped. The proposed 8px gap between password input, checkbox label, and button still exceeds the 4px minimum touch target spacing.
- **Breakpoint alignment** — Using 768px matches `main-nav.tsx`. Mixing universal (padding, margin) and responsive (form gap) changes is clean: the universal fixes solve the "every display" complaint, while responsive tweaks refine mobile further.
- **Only affects settings page** — Other pages with `panelCss` (admin pages, etc.) keep their current padding. If the consistency pass is applied broadly, it would need extraction to `page-primitives.tsx`. For this change, all adjustments are local to `controller.tsx`.
