## Purpose

Browser tests for the appointment grid's pointer gesture interactions — the core appointment booking surface. These are the interactive behaviors that are not covered by the existing CSS/rendering-focused test file.

## ADDED Requirements

### Requirement: Drag to move an appointment
The system SHALL allow dragging an appointment block to a different time slot on the same day or a different day.

#### Scenario: Drag block to different time on same day
- **WHEN** user pointerdown on an appointment block, drags vertically to a different time slot, and pointerup
- **THEN** the block position updates to the new time slot visually, and a POST mutation is sent to the server

#### Scenario: Drag block to different day
- **WHEN** user pointerdown on an appointment block, drags horizontally to a different day column, and pointerup
- **THEN** the block moves to the new day's column, and a POST mutation is sent

#### Scenario: Drag below threshold does not trigger mutation
- **WHEN** user pointerdown and drags less than DRAG_THRESHOLD pixels
- **THEN** the block snaps back to its original position, no mutation is sent

### Requirement: Drag to resize an appointment
The system SHALL allow resizing an appointment by dragging the start or end resize handle.

#### Scenario: Resize end handle increases duration
- **WHEN** user pointerdown on the bottom resize handle of a block, drags downward, and pointerup
- **THEN** the block height increases, and a POST mutation updates the end_min

#### Scenario: Resize start handle decreases start time
- **WHEN** user pointerdown on the top resize handle of a block, drags upward, and pointerup
- **THEN** the block top moves up, height increases, and a POST mutation updates the start_min

#### Scenario: Resize respects minimum duration
- **WHEN** user drags a resize handle to make the block smaller than minimum duration (start_min + 15)
- **THEN** the resize is clamped at the minimum duration boundary

### Requirement: Type-drag to create an appointment
The system SHALL allow creating a new appointment by dragging an appointment type from the type panel onto the grid.

#### Scenario: Drag type onto empty slot creates appointment
- **WHEN** user pointerdown on an appointment type in the side panel, drags onto an empty grid slot, and pointerup
- **THEN** a new block appears at that slot with the type's label, and a POST mutation creates the appointment

#### Scenario: Drag type onto occupied slot shows collision
- **WHEN** user drags a type onto a slot already occupied by another appointment
- **THEN** the slot is visually marked as a collision (COLLISION_STATUS), and the mutation is not sent

### Requirement: Drop on trashcan to delete
The system SHALL allow deleting an appointment by dragging it onto a trashcan area.

#### Scenario: Drag block to trashcan deletes it
- **WHEN** user drags an existing appointment block over the trashcan area
- **THEN** the block visually enters a deletion-pending state, and on pointerup it is removed with a DELETE mutation

### Requirement: Click-to-edit inline rename
The system SHALL allow renaming an appointment by clicking its title.

#### Scenario: Click title enters edit mode
- **WHEN** user clicks on an appointment block title
- **THEN** the title is replaced by an input pre-filled with the current title

#### Scenario: Shift+Enter commits rename
- **WHEN** user edits the title in the input and presses Shift+Enter
- **THEN** the input is replaced by the updated title, and a PUT mutation updates the appointment

#### Scenario: Escape cancels rename
- **WHEN** user edits the title and presses Escape
- **THEN** the input reverts to the original title, no mutation is sent

### Requirement: Grid renders virtual viewport based on server data
The system SHALL render appointment blocks based on embedded JSON data from the server-rendered DOM.

#### Scenario: Blocks render from embedded JSON data
- **WHEN** the grid initializes with appData containing appointment blocks
- **THEN** each block is rendered at the correct vertical position matching start_min and duration

#### Scenario: Gesture state does not pollute other grid instances
- **WHEN** a drag gesture is active on one grid
- **THEN** interactionState.active is true, and no other grid or SSE subscriber triggers a reload
