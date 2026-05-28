## ADDED Requirements

### Requirement: Foreign appointment blocks hide title and tooltip for non-admin users

The system SHALL render appointment blocks belonging to other users as colored areas without title text or hover tooltip when viewed by a non-admin user.

#### Scenario: Foreign block has no title text for non-admin

- **WHEN** a non-admin user views the appointment grid
- **AND** a foreign appointment block is rendered
- **THEN** the block SHALL display only a colored area
- **AND** the block SHALL NOT show the appointment title text

#### Scenario: Foreign block has no hover tooltip for non-admin

- **WHEN** a non-admin user hovers over a foreign appointment block
- **THEN** no tooltip SHALL appear

#### Scenario: Foreign block has cursor default for non-admin

- **WHEN** a non-admin user views a foreign appointment block
- **THEN** the block SHALL have `cursor: default`

#### Scenario: Own block shows full details regardless of role

- **WHEN** any user views an appointment they own
- **THEN** the block SHALL display the title text and be fully interactive

#### Scenario: Admin sees full details for all blocks

- **WHEN** an admin user views the appointment grid
- **THEN** all appointment blocks (own and foreign) SHALL display full title text and details

### Requirement: Server embeds isAdmin flag in page data

The system SHALL include an `isAdmin` boolean in the embedded JSON data on the appointment page, allowing the client-side grid to adjust rendering based on the user's role.

#### Scenario: Admin views page

- **WHEN** an admin user visits `/appointments`
- **THEN** the embedded JSON SHALL contain `"isAdmin": true`

#### Scenario: Non-admin views page

- **WHEN** a non-admin user visits `/appointments`
- **THEN** the embedded JSON SHALL contain `"isAdmin": false`
