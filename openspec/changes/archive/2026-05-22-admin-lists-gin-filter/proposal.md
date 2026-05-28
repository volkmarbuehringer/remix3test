## Why

The `/admin/lists` page currently has no search/filter capability. Users managing lists need to find specific lists by their contents (item labels) or description, but must manually paginate through all rows. Adding GIN-indexed filtering will make the admin panel practical for real use as the list count grows.

## What Changes

- Add a search text box to `/admin/lists` with `rmx-target` for frame-based filtering
- Add a `filter` query parameter to the index action
- Create a GIN index on the `list` JSONB column for exact containment queries
- Create a GIN trigram index on the `description` column for partial ILIKE searches
- Add a `filter` state-preserving redirect in the destroy action (to stay on filtered view)
- Extend the `AdminListsPage` component with a filter form matching the nutzer pattern

## Capabilities

### New Capabilities
- `admin-lists-filter`: Search/filter lists by item labels (via `jsonb_array_elements` + `ILIKE`) and description (via `ILIKE`), with GIN-backed indexes for performance

### Modified Capabilities
<!-- No existing specs changed -->

## Impact

- **Database**: Two new indexes on the `lists` table (`idx_lists_list` via GIN `jsonb_path_ops`, `idx_lists_desc` via GIN trigram `gin_trgm_ops`)
- **Controller**: `admin-lists-controller.tsx` index action gains `filter` param handling; destroy action preserves filter in redirect
- **Page component**: `admin-lists-page.tsx` gains a filter form above the table
- **Tests**: `admin-lists-controller` test file needs to be created (currently none exists) covering auth gating, filter, pagination
