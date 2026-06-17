## ADDED Requirements

### Requirement: Context menu survives Frame navigation

The context menu SHALL remain functional after any Frame-targeted navigation (sort, paginate, filter). A full page reload SHALL NOT be required to re-enable the context menu.

#### Scenario: Context menu works after sort

- **GIVEN** the offerings table renders with data
- **WHEN** a user clicks a sortable column header to change sort order
- **AND** the Frame content updates with the new sort
- **THEN** right-clicking on any row SHALL still open the context menu

#### Scenario: Context menu works after pagination

- **GIVEN** the offerings table renders with multiple pages
- **WHEN** a user clicks "Weiter" to navigate to the next page
- **AND** the Frame content updates with the next page
- **THEN** right-clicking on any row SHALL still open the context menu

#### Scenario: Context menu works after filter

- **GIVEN** the offerings table renders with data
- **WHEN** a user submits a filter search
- **AND** the Frame content updates with filtered results
- **THEN** right-clicking on any row SHALL still open the context menu
