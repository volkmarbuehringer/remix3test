## ADDED Requirements

### Requirement: Keyboard navigation and reordering

The editor item list SHALL be fully operable from the keyboard. Exactly one item row SHALL be in the tab order at a time (roving tabindex); `ArrowUp`/`ArrowDown` move focus between rows and `Home`/`End` jump to the first/last row. Printable-character typeahead SHALL move focus to the first row whose label starts with that character. Reordering SHALL be possible via two gestures: a **grab model** (`Enter`/`Space` picks up the focused item, `ArrowUp`/`ArrowDown` move it, `Enter`/`Space` drops, `Esc` cancels) and a **quick-move** model (`Ctrl+ArrowUp` / `Ctrl+ArrowDown` moves the focused item directly). Focus SHALL follow the item by its stable id across reorders. A visually-hidden `aria-live` region SHALL announce grab, move, drop, and cancel events with the item's position. The sidebar list rows SHALL receive the same roving-tabindex navigation with `Enter`/`Space` activation, matching the existing click-to-navigate behavior.

#### Scenario: Roving focus moves with arrows

- **WHEN** the editor item list is rendered and the user presses `ArrowDown` from the focused row
- **THEN** focus moves to the next row and only that row is in the tab order
- **AND** `Home` moves focus to the first row and `End` to the last row

#### Scenario: Grab model reorders an item

- **WHEN** the user focuses an item, presses `Enter`/`Space` to grab it, presses `ArrowDown`, then presses `Enter`/`Space` to drop
- **THEN** the item is moved one position down in the list
- **AND** the list is marked dirty and the fast autosave path is triggered
- **AND** focus remains on the same item (by id) after the drop

#### Scenario: Quick-move reorders without a grab state

- **WHEN** the user focuses an item and presses `Ctrl+ArrowUp`
- **THEN** the item moves up one position and focus follows it
- **AND** no grab state is entered or required

#### Scenario: Escape cancels a grab

- **WHEN** the user grabs an item and then presses `Esc`
- **THEN** the item is not reordered and the grab state is cleared

#### Scenario: Typeahead jumps to a matching row

- **WHEN** the user types a printable character while an item row is focused
- **THEN** focus moves to the first row whose label starts with that character

#### Scenario: Live region announces reorder

- **WHEN** an item is grabbed, moved, or dropped
- **THEN** a visually-hidden `aria-live="polite"` region announces the action and the item's position ("X von N")

#### Scenario: Sidebar rows are keyboard navigable

- **WHEN** the user tabs to the sidebar list and presses `ArrowDown` / `Enter`
- **THEN** focus moves between list rows and `Enter`/`Space` navigates to the focused list, matching the existing click behavior
