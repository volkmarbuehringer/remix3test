## ADDED Requirements

### Requirement: User can reorder list items via drag and drop

The system SHALL allow users to reorder list items by dragging them with a dedicated grip handle and dropping them at a new position. The item order in the JSONB array SHALL update immediately to reflect the new position.

#### Scenario: Drag item to a new position
- **WHEN** user grabs the grip handle on a list item and drags it to a position between two other items
- **THEN** the dragged item moves to the drop position and all items re-index accordingly

#### Scenario: Drop indicator shown during drag
- **WHEN** user drags an item over the list
- **THEN** a visual drop indicator line appears between items at the current hover position

#### Scenario: Dragged item has reduced opacity
- **WHEN** user is actively dragging an item
- **THEN** the dragged item displays with reduced opacity to indicate active drag state

#### Scenario: Cancel drag via Escape
- **WHEN** user presses Escape during a drag operation
- **THEN** the drag is cancelled and items return to their original order

#### Scenario: Drop outside list cancels reorder
- **WHEN** user drops the dragged item outside the list container
- **THEN** the drag is cancelled and item order remains unchanged

### Requirement: Drag handle provides clear visual affordance

Each list item SHALL display a grip icon (⠿) as the sole activation zone for drag-and-drop. The grip handle SHALL show a grab cursor on hover.

#### Scenario: Drag handle renders on each item
- **WHEN** a list item is rendered
- **THEN** it displays a grip icon at the left edge of the item, before the index badge

#### Scenario: Grip handle hover cursor
- **WHEN** user hovers over the grip handle
- **THEN** the cursor changes to `grab` (and `grabbing` while dragging)

### Requirement: Existing move buttons remain functional

The ↑↓ arrow buttons SHALL remain available as an alternative reordering method alongside drag-and-drop.

#### Scenario: Move up/down buttons still work
- **WHEN** user clicks the ↑ or ↓ button on a list item
- **THEN** the item moves one position up or down as before

#### Scenario: Reverse and shuffle still work
- **WHEN** user clicks the Reverse or Shuffle button
- **THEN** items reorder as before, preserving all interactions
