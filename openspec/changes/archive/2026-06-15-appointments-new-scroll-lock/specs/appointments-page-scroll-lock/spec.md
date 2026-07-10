# Appointments Page Scroll Lock

## Purpose

Lock document scroll while the side panel (create/edit/delete) is open on `/appointments/new`, so the background table content does not scroll behind the panel.

## ADDED Requirements

### Requirement: Scroll is locked when the side panel opens

The system SHALL lock page scrolling when the side panel is visible on `/appointments/new` for create, edit, or delete operations.

#### Scenario: Panel open locks scroll

- **WHEN** user navigates to `/appointments/new?editing=<id>`
- **THEN** the page scroll is locked (overflow: hidden on the document element)

#### Scenario: Panel open locks for delete

- **WHEN** user navigates to `/appointments/new?deleting=<id>`
- **THEN** the page scroll is locked

#### Scenario: Panel open locks for create

- **WHEN** user navigates to `/appointments/new?creating=true`
- **THEN** the page scroll is locked

### Requirement: Scroll is unlocked when the panel closes

The system SHALL restore page scrolling when the panel is no longer visible.

#### Scenario: Back/forward navigation unlocks scroll

- **WHEN** user navigates away from panel state via browser back
- **THEN** the page scroll is unlocked

#### Scenario: Form submission redirect unlocks scroll

- **WHEN** user submits a create/edit/delete form and is redirected to the base page
- **THEN** the page scroll is unlocked

### Requirement: Scrollbar gutter is preserved

The system SHALL prevent layout shift when scrollbar disappears by compensating with `scrollbar-gutter: stable` while the lock is active.

#### Scenario: No layout shift on panel open

- **WHEN** the scroll lock activates
- **THEN** the document's scrollbar-gutter is set to `stable`
- **THEN** no content reflow occurs

### Requirement: Scroll position is restored

The system SHALL restore the saved scroll position when the last scroll lock is released.

#### Scenario: Scroll position restored after unlock

- **WHEN** user scrolls while panel is open
- **AND** the panel closes
- **THEN** the scroll position is restored to the value before the panel was opened
