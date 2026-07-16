## ADDED Requirements

### Requirement: findList supports sort parameter

The `findList` tool SHALL accept an optional `sort` parameter with values `"newest"` (default) or `"oldest"`. When `sort` is `"newest"`, results SHALL be ordered by `updated_at DESC`. When `sort` is `"oldest"`, results SHALL be ordered by `updated_at ASC`.

#### Scenario: Sort newest returns most recently updated first

- **WHEN** the agent calls `findList({ sort: "newest" })`
- **THEN** the results SHALL be ordered by `updated_at` descending, with the most recently updated list first

#### Scenario: Sort oldest returns least recently updated first

- **WHEN** the agent calls `findList({ sort: "oldest" })`
- **THEN** the results SHALL be ordered by `updated_at` ascending, with the least recently updated list first

#### Scenario: Default sort is newest

- **WHEN** the agent calls `findList({ search: "shopping" })` without specifying `sort`
- **THEN** the sort order SHALL default to `"newest"` (`ORDER BY updated_at DESC`)

### Requirement: findList supports limit parameter

The `findList` tool SHALL accept an optional `limit` parameter (integer, default 10, maximum 50). The SQL query SHALL use `LIMIT limit + 1` for the hasMore calculation, matching the existing `getAllLists` pattern.

#### Scenario: Custom limit returns at most that many rows

- **WHEN** the agent calls `findList({ sort: "newest", limit: 3 })` and there are 10 lists
- **THEN** the response SHALL contain at most 3 list entries

#### Scenario: Limit is capped at 50

- **WHEN** the agent calls `findList({ limit: 100 })`
- **THEN** the tool SHALL clamp the limit to 50

#### Scenario: hasMore flag indicates more pages

- **WHEN** `findList` is called with `limit: 5` and 8 lists match
- **THEN** the response SHALL include `hasMore: true` and exactly 5 list entries

### Requirement: findList supports offset parameter

The `findList` tool SHALL accept an optional `offset` parameter (integer, default 0). The SQL query SHALL use `OFFSET offset` for pagination alongside `limit`.

#### Scenario: Offset skips previous results

- **WHEN** the agent calls `findList({ sort: "newest", limit: 5, offset: 5 })`
- **THEN** the response SHALL return the second page of results, skipping the first 5
