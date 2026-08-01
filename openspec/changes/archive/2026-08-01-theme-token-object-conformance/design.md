## Context

The theme system exposes a typed token tree (`app/ui/theme/contract.ts`) and a frozen `theme` object of `--rmx-*` variable-name strings (`app/ui/theme/theme.ts`). Light/dark values are defined in `app/theme.tsx`. Six client stream files and two agent pages embed raw `var(--rmx-...)` strings (and two orphan variables, `--rmx-color-success`/`--rmx-color-warning`) in hand-built DOM style strings. See proposal.md — Why.

## Goals / Non-Goals

**Goals:**
- All stream/agent styling resolves through the `theme` object so keys are type-checked against the contract.
- The theme gains real `success`/`warning` tokens so status colors track light/dark.
- Provide a repeatable conformance guard (skill + lint) for future styling.

**Non-Goals:**
- Not converting the ~10 unrelated UI files with hardcoded hex (`scaffold-home-page.tsx`, `webhook-requests-page.tsx`, `main-nav.tsx`, etc.) — tracked separately.
- Not converting PDF/export palettes (pdfmake) or agent tool colors, which are not DOM styling.
- No change to the `--rmx-` variable naming convention or the cascade-layer setup.

## Decisions

**Decision 1: Interpolate `theme.*` into existing template-literal style strings, not rewrite to `css()` mixins.**
The stream files build imperative `style.cssText`/`innerHTML` strings inside `clientEntry` callbacks; they are not component markup. Swapping `'var(--rmx-surface-lvl1)'` → `${theme.surface.lvl1}` keeps the change minimal and behavior identical. The `theme` object is a plain frozen object of strings, so importing it client-side is safe.
*Alternative rejected:* converting the streams to `css()` mixins would restructure `clientEntry` code beyond the bypass fix.

**Decision 2: Add `success` and `warning` token groups to the contract.**
Place them under `colors` as sibling groups to `text`/`border`/`action`, each with `background`, `foreground`, and `border` keys (mirroring the existing `danger` shape). Values go in both `Theme` and `DarkTheme` in `app/theme.tsx`, derived from the existing light/dark success/danger palette already present in the surface groups (`successBg`/`successText`/`successBorder`).
*Alternative rejected:* mapping success/warning to existing tokens (`action.primary`) would collapse distinct status semantics into one color and change the UI.

**Decision 3: Keep orphan detection as a lint rule.**
Add an oxlint rule (or a check step) flagging `var(--rmx-` literals in `app/`, excluding `app/ui/theme/` and `app/theme.tsx` where the variables are defined. This makes the "no orphan references" spec requirement mechanically enforced.
*Alternative rejected:* relying only on the skill leaves enforcement to authoring discipline.

## Risks / Trade-offs

- [Stream style strings change the emitted CSS text only cosmetically (var name → resolved var name)] → Mitigation: the resolved runtime value is identical, so no visual change; verified by the existing stream tests.
- [New `success`/`warning` tokens must not collide with the orphan variable names the streams currently use] → Mitigation: contract keys map to `--rmx-color-success-*`/`--rmx-color-warning-*` with `-background`/`-foreground`/`-border` suffixes; the old orphans used bare `--rmx-color-success` (no suffix), so no collision.
- [`theme` import in browser bundles adds a small module graph edge] → Mitigation: the object is statically frozen data; tree-shaking already covers it since the files import from `remix/ui` today.

## Migration Plan

1. Add `success`/`warning` groups to `app/ui/theme/contract.ts`.
2. Add light/dark values in `app/theme.tsx`.
3. Rewrite the 8 files' style strings to interpolate `theme.*`.
4. Add the lint rule; run `npm test` and `npm run typecheck`.
5. Visual check of status indicators in light and dark mode.

Rollback: revert the single commit; token values and references move together.

## Open Questions

None.
