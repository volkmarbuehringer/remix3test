## ADDED Requirements

### Requirement: Restore filter input value after frame reload

The filter input SHALL have its value restored from URL query parameters after every frame reload.

#### Scenario: Agent navigation includes filter parameter

Given the agent emits a `navigate` event to `/admin/users?filter=fritz`
When `handleNavigate` completes the frame reload
Then the input with `name="filter"` SHALL have its `.value` set to `"fritz"`

#### Scenario: User submits filter form

Given the user submits the GET filter form with `filter=fritz`
When `handleFrameFormSubmit` completes the frame reload
Then the input with `name="filter"` SHALL have its `.value` set to `"fritz"`

#### Scenario: No filter parameter in URL

Given the frame loads `/admin/users` without a `filter` parameter
When the frame reload completes
Then the input with `name="filter"` SHALL have its `.value` set to `""`
