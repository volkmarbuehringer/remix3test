## ADDED Requirements

### Requirement: Drop zone visual feedback

The types panel SHALL display a visual drop zone indicator when an appointment block is being dragged over it.

#### Scenario: Highlight on hover

- **WHEN** a user drags an appointment block over the types panel
- **THEN** the panel border SHALL change to a highlighted color (e.g., accent color)

#### Scenario: Remove highlight on leave

- **WHEN** a user drags an appointment block away from the types panel
- **THEN** the panel border SHALL return to its default appearance

#### Scenario: No highlight during type-drag

- **WHEN** a user is dragging from the types panel itself (type-to-grid drag)
- **THEN** the drop zone SHALL NOT be highlighted (only applies to grid-to-panel drag)
