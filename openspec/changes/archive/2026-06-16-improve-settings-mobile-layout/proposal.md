## Why

The settings page stacks four panels vertically with uniform desktop spacing. On mobile, the layout feels loose — especially the "Konto löschen" (delete account) section, which has excessive vertical whitespace on every viewport size due to an extra `marginTop: 24px` on top of the normal section gap, plus generous internal padding relative to its sparse content (heading, warning, one input, checkbox, button).

## What Changes

- Remove `marginTop: theme.space.xl` from `deletePanelCss` — let the section gap handle vertical separation
- Reduce internal padding of the delete panel on mobile (`theme.space.md` instead of `theme.space.lg`)
- Tighten form grid gap within the delete section on mobile (`theme.space.sm` instead of `theme.space.md`)
- Reduce warning text bottom margin within the delete panel on mobile
- Optionally: apply responsive padding reduction across all settings panels on mobile for consistency

## Capabilities

### New Capabilities
- `settings-mobile-layout`: Responsive spacing rules for the settings page — compact panels, tighter gaps, and proportional height for the delete account section on viewports ≤768px

### Modified Capabilities
- (none)

## Impact

- `app/actions/settings/controller.tsx` — CSS token changes only, no controller logic
- No routing, data, or API changes
- No new dependencies
