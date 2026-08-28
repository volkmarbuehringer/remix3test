## ADDED Requirements

### Requirement: Question card is styled within agent bar

The question card layout SHALL be styled to fit within the `#agent-bar` container with clear visual hierarchy.

#### Scenario: Question card has appropriate spacing

- **WHEN** a structured question is rendered
- **THEN** options SHALL be vertically stacked
- **AND** each option row SHALL have sufficient vertical spacing for readability
- **AND** the confirm button SHALL be visually distinct from the options
- **AND** the bar container SHALL allow the card to expand beyond its default `maxHeight`