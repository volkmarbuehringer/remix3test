## ADDED Requirements

### Requirement: Lists page renders interactive list manager

The app SHALL provide a `/lists` route that renders an interactive list manager component. The component SHALL be a `clientEntry` that works identically on server and client (isomorphic), then hydrates in the browser.

The page SHALL be wrapped in the app's `<Layout>` so it has the header nav (including the Lists nav item), theme, and footer.

#### Scenario: GET /lists returns 200 with interactive list

- **WHEN** a user navigates to `/lists`
- **THEN** the page SHALL render the interactive list manager UI within the app layout
- **AND** the page SHALL include a script reference to the `lists-client.tsx` client entry

### Requirement: List manager supports add operation

The component SHALL provide a textarea input and "+ Add Item" button. When the user enters text and clicks the button (or presses Enter), a new list item with that label SHALL be appended to the list.

#### Scenario: User adds an item

- **WHEN** the user types "Buy milk" in the textarea and clicks "+ Add Item"
- **THEN** a new item with label "Buy milk" SHALL appear at the bottom of the list

### Requirement: List manager supports edit operation

Each list item SHALL have an Edit button. Clicking it SHALL replace the item's label display with a textarea pre-filled with the current label. A Save button SHALL commit the edit and return to display mode. A Cancel button (or Escape key) SHALL discard the edit.

#### Scenario: User edits an item

- **WHEN** the user clicks Edit on an item with label "Buy milk"
- **THEN** the label SHALL be replaced by a textarea containing "Buy milk"
- **WHEN** the user changes the text to "Buy oat milk" and clicks Save
- **THEN** the item SHALL display "Buy oat milk"

### Requirement: List manager supports delete operation

Each list item SHALL have a Delete button. Clicking it SHALL remove the item from the list.

#### Scenario: User deletes an item

- **WHEN** the user clicks Delete on an item
- **THEN** the item SHALL be removed from the rendered list

### Requirement: List manager supports reorder operations

Each list item SHALL have Move Up and Move Down buttons. Clicking Move Up SHALL swap the item with the one above it. Clicking Move Down SHALL swap it with the one below. The first item SHALL NOT have a Move Up button. The last item SHALL NOT have a Move Down button.

#### Scenario: User moves an item up

- **WHEN** the user clicks Move Up on the second item
- **THEN** the second item SHALL swap positions with the first item

### Requirement: List manager supports reverse operation

The component SHALL provide a Reverse button that reverses the order of all items in the list.

#### Scenario: User reverses the list

- **WHEN** the user clicks Reverse on a list with items [A, B, C]
- **THEN** the list SHALL display items in order [C, B, A]

### Requirement: List manager supports shuffle operation

The component SHALL provide a Shuffle button that randomizes the order of all items using a Fisher-Yates shuffle.

#### Scenario: User shuffles the list

- **WHEN** the user clicks Shuffle
- **THEN** the items SHALL appear in a new random order (different from current order, with high probability)

### Requirement: List manager persists to localStorage

The component SHALL save the current list items to `localStorage` under the key `lists-saved-items` whenever the user clicks a "Save List" button. On initial load, the component SHALL restore items from `localStorage` if data exists.

#### Scenario: Items persist across page reloads

- **WHEN** the user adds items, clicks Save List, then reloads the page
- **THEN** the previously saved items SHALL be displayed
