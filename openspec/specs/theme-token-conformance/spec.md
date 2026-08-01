# theme-token-conformance Specification

## Purpose

All UI styling resolves through the typed theme contract so colors track the active theme (light/dark) and broken variable references fail loudly instead of silently falling back to hardcoded values.

## Requirements

### Requirement: Styling resolves through the theme contract

UI styling MUST reference theme tokens through the typed `theme` object rather than embedding raw `var(--rmx-...)` literals or hardcoded color values in style strings. Token references MUST be verifiable against the theme contract at build time.

#### Scenario: Stream styling uses theme tokens
- **WHEN** a stream file (`app/assets/streams/*.browser.tsx`) applies a style string to a DOM element
- **THEN** every color, border, and surface reference resolves through the `theme` object from `app/ui/theme/theme.ts` and no raw `var(--rmx-...)` literals or hex fallbacks remain

#### Scenario: Agent page muted text follows theme
- **WHEN** `workflow-agent-page.tsx` or `agent-events-page.tsx` styles muted text
- **THEN** the color is `theme.colors.text.muted` and changes with the active theme instead of a hardcoded fallback

### Requirement: Theme exposes success and warning status colors

The theme MUST define `success` and `warning` token groups (light and dark variants) so status indicators track the active theme. Consumers MUST NOT rely on variables outside the contract.

#### Scenario: Success indicator resolves in both themes
- **WHEN** a status icon is styled with the success token in light mode and in dark mode
- **THEN** the resolved color differs appropriately between themes and never falls back to a hardcoded value

#### Scenario: Warning indicator resolves in both themes
- **WHEN** a status icon is styled with the warning token in light mode and in dark mode
- **THEN** the resolved color differs appropriately between themes and never falls back to a hardcoded value

### Requirement: No orphan theme variable references

The application MUST NOT reference `--rmx-*` variables that the theme does not define.

#### Scenario: Undefined variable references are absent
- **WHEN** scanning the styling sources for `var(--rmx-...)` literals
- **THEN** no references exist to variables outside the theme contract, including the former `--rmx-color-success` and `--rmx-color-warning` orphans
