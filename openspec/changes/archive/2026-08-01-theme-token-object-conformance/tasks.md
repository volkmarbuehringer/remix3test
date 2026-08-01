## 1. Theme tokens

- [x] 1.1 Add `success` and `warning` token groups to the contract in `app/ui/theme/contract.ts` under `colors`, each with `background`, `foreground`, and `border` keys (mirroring the `danger` shape), mapping to `--rmx-color-success-*` / `--rmx-color-warning-*` variable names
- [x] 1.2 Add matching light values for `colors.success` and `colors.warning` to `Theme` in `app/theme.tsx` (derive from the existing `successBg`/`successText`/`successBorder` surface palette; pick warning values that contrast on both `--rmx-surface-lvl0` and `--rmx-surface-lvl1`)
- [x] 1.3 Add matching dark values for `colors.success` and `colors.warning` to `DarkTheme` in `app/theme.tsx`
- [x] 1.4 Add a typecheck-proof assertion (e.g. a `theme.colors.success.background` reference in a test or the theme module) so the new keys are exercised by `npm run typecheck`

## 2. Stream file conversions

Convert every raw `var(--rmx-...)` literal and its hex fallback to an interpolated `theme.<group>.<token>` reference. Import `theme` from `../../ui/theme/theme.ts` (or the correct relative path) in each file.

- [x] 2.1 Convert `app/assets/streams/customer-chat-stream.browser.tsx` (26 raw `var(--rmx-...)` references)
- [x] 2.2 Convert `app/assets/streams/workflow-agent-stream.browser.tsx` (23 refs; `--rmx-color-success`/`--rmx-color-warning` become `theme.colors.success.*` / `theme.colors.warning.*`)
- [x] 2.3 Convert `app/assets/streams/support-agent-stream.browser.tsx` (20 refs)
- [x] 2.4 Convert `app/assets/streams/test-agent-stream.browser.tsx` (12 refs)
- [x] 2.5 Convert `app/assets/streams/agent-events-stream.browser.tsx` (9 refs)
- [x] 2.6 Convert `app/assets/streams/route-agent-stream.browser.tsx` (4 refs)
- [x] 2.7 Convert `app/assets/streams/streams.test.browser.tsx` (13 refs; status icon colors use `theme.colors.success.*`, `theme.colors.warning.*`, `theme.colors.action.danger.*`)

## 3. Agent page conversions

- [x] 3.1 Replace `color: 'var(--rmx-color-text-muted, #888)'` at `app/ui/workflow-agent-page.tsx:97` with `theme.colors.text.muted`
- [x] 3.2 Replace `color: 'var(--rmx-color-text-muted, #888)'` at `app/ui/agent-events-page.tsx:97` with `theme.colors.text.muted`
- [x] 3.3 Verify no raw `var(--rmx-` literals remain in `app/ui/workflow-agent-page.tsx` or `app/ui/agent-events-page.tsx`

## 4. Conformance guard

- [x] 4.1 Add a check (grep-based script or oxlint rule) that fails when `var(--rmx-` appears outside `app/ui/theme/` and `app/theme.tsx`; wire it into the `lint` npm script
- [x] 4.2 Confirm the learned skill `remix3-theme-object-conformance` (created with this change) documents the token groups including `success`/`warning`

## 5. Verification

- [x] 5.1 Run `npm run typecheck` and fix any type errors (invalid `theme.*` keys surface here)
- [x] 5.2 Run `npm test` (streams + page tests must stay green)
- [x] 5.3 Run `npm run lint` (including the new conformance check)
- [x] 5.4 Manually verify status indicators (success/warning/danger) in light and dark mode on the agent and workflow pages
