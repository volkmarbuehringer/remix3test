## Why

Six stream files (`app/assets/streams/*.browser.tsx`) and two agent pages (`app/ui/workflow-agent-page.tsx`, `app/ui/agent-events-page.tsx`) bypass the typed theme contract by embedding raw `var(--rmx-...)` strings and hardcoded hex colors in style strings. Two of those variables (`--rmx-color-success`, `--rmx-color-warning`) are not part of the theme at all, so the "theme-aware" code always falls back to hardcoded hex and silently ignores the theme (including dark mode).

## What Changes

- Replace all raw `var(--rmx-...)` literals in the 6 stream files with interpolated `theme.<group>.<token>` references imported from `app/ui/theme/theme.ts`.
- Replace `color: 'var(--rmx-color-text-muted, #888)'` in `app/ui/workflow-agent-page.tsx:97` and `app/ui/agent-events-page.tsx:97` with `theme.colors.text.muted` (both files already import `theme`).
- Add `success` and `warning` token groups to the theme contract (`app/ui/theme/contract.ts`) and to both `Theme` (light) and `DarkTheme` (dark) value sets in `app/theme.tsx`, replacing the fallback hex values (`#28a745`, `#ffc107`) currently embedded in the stream files.
- Add a conformance guard so future styling uses the typed `theme` object (skill + lint coverage where feasible).

## Capabilities

### New Capabilities

- `theme-token-conformance`: all UI styling resolves through the typed theme contract (`theme.<group>.<token>`); the theme exposes `success` and `warning` status color tokens; no raw `var(--rmx-...)` literals or hardcoded status colors remain in stream/agent styling.

### Modified Capabilities

None.

## Impact

- `app/assets/streams/*.browser.tsx` (6 files) — style strings now interpolate `theme.*` tokens.
- `app/ui/workflow-agent-page.tsx`, `app/ui/agent-events-page.tsx` — muted-text color via `theme.colors.text.muted`.
- `app/ui/theme/contract.ts` — new `success` / `warning` token groups under `colors`.
- `app/theme.tsx` — light + dark values for the new tokens.
- `.opencode/skills/learned/remix3-theme-object-conformance/SKILL.md` — conformance guidance for future styling.
- No runtime API changes; the emitted CSS variable names keep the `--rmx-` prefix convention.
