## MODIFIED Requirements

### Requirement: Update appointment

The system SHALL allow users to update appointments.

**Changes**: The drag-to-move and resize-duration scenarios are now implemented. Added visual feedback and minimum duration constraints.

#### Scenario: Drag to move

- **WHEN** a user drags an appointment block to a different day or time
- **THEN** a ghost block SHALL appear at the target position during drag
- **THEN** the dragged block SHALL follow the pointer with smooth visual offset
- **THEN** on drop, the block SHALL move to the new position snapped to 15-minute grid slots
- **THEN** the new position SHALL be saved to the server via PUT with `date`, `start_min`, `end_min`
- **THEN** overlapping blocks SHALL be shifted by the layout solver before saving

#### Scenario: Resize duration

- **WHEN** a user drags the top or bottom edge of an appointment block
- **THEN** a resize handle SHALL appear on hover at the top and bottom edges
- **THEN** the block SHALL resize following the pointer, snapped to 15-minute intervals
- **THEN** the minimum duration SHALL be 15 minutes
- **THEN** on release, the new duration SHALL be saved to the server via PUT with `start_min` or `end_min`
- **THEN** overlapping blocks SHALL be shifted by the layout solver before saving

#### Scenario: Inline rename

- **WHEN** a user double-clicks an appointment title
- **THEN** the title SHALL become editable and SHALL be saved on Enter or blur

#### Scenario: Conflict resolution

- **WHEN** dragging or resizing would overlap another block
- **THEN** the layout SHALL resolve the overlap by shifting blocks using a cost-based algorithm
- **THEN** the algorithm SHALL minimize: number of shifted blocks, then total distance shifted, then natural index distance
- **THEN** if resolution is impossible, the drop SHALL be rejected and blocks SHALL return to original positions
