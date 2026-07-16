## ADDED Requirements

### Requirement: ids parameter does not alter write semantics

The presence of `?ids=` on the frame URL MUST NOT affect the behavior of `create`, `patch`, or `destroy` actions. After a write, the redirect / reload SHALL drop the `ids` parameter so the sidebar returns to the user's full list set.

#### Scenario: Save while ids filter active returns to full list set

- **WHEN** the user saves an edit while `?ids=1,5,12&load=5` is in the frame URL
- **THEN** the post-save reload sets `?load=5` (without `ids=1,5,12`)
- **AND** the sidebar shows the unfiltered set so the user can confirm the saved list is present
