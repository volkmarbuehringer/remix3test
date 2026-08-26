## MODIFIED Requirements

### Requirement: Grid filter form targets the admin content frame

The grid filter form (a GET form with `action="/admin/clients"`) in the admin client page SHALL declare `data-rmx-target="admin-content"` so its submission is a native frame navigation that reloads only the content frame instead of the top-level page.

#### Scenario: Filter submission does not reload the top-level page

- **WHEN** the grid filter form is submitted from inside the admin frame
- **THEN** the page SHALL NOT perform a full top-level reload
- **AND** only the `admin-content` frame SHALL be navigated with the query parameters
- **AND** `restoreFilterValue` SHALL restore the filter input's value after the frame reload
