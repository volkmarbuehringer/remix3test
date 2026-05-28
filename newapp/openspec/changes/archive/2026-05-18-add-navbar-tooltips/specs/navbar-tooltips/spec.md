## ADDED Requirements

### Requirement: Tooltip appears on hover and focus for icon-only navbar buttons

Icon-only buttons in the top navigation bar SHALL display a visual tooltip label when hovered or focused.

#### Scenario: Tooltip appears on hover
- **WHEN** a user hovers the mouse over the logout button or theme toggle button
- **THEN** a tooltip label SHALL appear below the icon after a 300ms delay

#### Scenario: Tooltip appears on keyboard focus
- **WHEN** a user tabs to the logout button or theme toggle button (keyboard focus)
- **THEN** a tooltip label SHALL appear below the icon

#### Scenario: Tooltip disappears on mouse leave
- **WHEN** the mouse leaves the button area
- **THEN** the tooltip SHALL disappear immediately

### Requirement: Tooltip displays correct label for each button

Each button SHALL show its purpose as tooltip text.

#### Scenario: Logout button shows "Logout"
- **WHEN** hovering or focusing the logout button
- **THEN** the tooltip SHALL display the text "Logout"

#### Scenario: Theme toggle button shows "Toggle dark mode"
- **WHEN** hovering or focusing the theme toggle button
- **THEN** the tooltip SHALL display the text "Toggle dark mode"

### Requirement: Tooltip has consistent visual styling

Tooltips SHALL be styled consistently between both buttons.

#### Scenario: Tooltip is a dark rounded overlay
- **WHEN** a tooltip is visible
- **THEN** it SHALL have a dark background, light text, small font size, rounded corners, and be positioned below the icon
