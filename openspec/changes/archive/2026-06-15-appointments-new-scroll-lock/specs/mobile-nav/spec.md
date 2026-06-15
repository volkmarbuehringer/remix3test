# Mobile Nav Capability (Delta)

## MODIFIED Requirements

### Requirement: Open overlay locks scroll with scrollbar-gutter compensation

The system SHALL lock page scrolling when the mobile nav overlay is open, and SHALL use the `lockScroll()` utility from `remix/ui/scroll-lock` instead of manually setting `document.body.style.overflow`.

#### Scenario: Nav drawer opens with proper scroll lock
- **WHEN** user taps the hamburger toggle
- **THEN** the nav drawer opens
- **THEN** the document scroll is locked using `lockScroll()` (not raw `overflow: hidden`)
- **THEN** the scrollbar gutter is compensated to prevent layout shift
- **THEN** the scroll position is saved

#### Scenario: Nav drawer closes restores scroll
- **WHEN** user taps the close button, the Escape key, or clicks outside the drawer
- **THEN** the nav drawer closes
- **THEN** the scroll is unlocked
- **THEN** the original scroll position is restored
