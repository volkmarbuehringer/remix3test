## Why

Resources currently have a short `description` field rendered as a single-line text input, but it's unused in customer workflows. Admins need to describe resource capabilities in detail (what services each resource offers), and customers need a way to describe their problem and be matched to the right resource automatically — without knowing resource names or browsing through lists.

## What Changes

- Add a new `capabilities` column (TEXT, nullable) to the resources table to hold detailed multiline capability descriptions of what the resource can do
- Add a multiline textarea labeled "Capabilities" in the admin resource form, alongside the existing `name` and `description` fields
- Create a new customer-facing chat route `/chat` with a Mastra agent that takes a free-text problem description, searches resource capabilities, and recommends the best matching resource
- Add a tool to the new agent that queries resource capabilities via full-text search
- Add a Mastra agent for customer resource matching, registered alongside the existing support agent
- Future: the matching step can be composed into a workflow that books an appointment with the matched resource

## Capabilities

### New Capabilities

- `resource-capabilities`: New `capabilities` column on the resources table with a multiline textarea in the admin panel; full-text searchable via GIN trigram index
- `customer-resource-chat`: Customer-facing Mastra agent that accepts problem descriptions, searches resource capabilities, and recommends the best-fitting resource

### Modified Capabilities

- `resources-form-validation`: Add validation rules for the new `capabilities` field alongside existing name and description fields

## Impact

- **DB**: New `capabilities TEXT` column on `resources`; migration with `ALTER TABLE ... ADD COLUMN IF NOT EXISTS capabilities TEXT DEFAULT ''`. GIN trigram index on `capabilities` for full-text search
- **Admin UI**: Add a new textarea field "Capabilities" below the existing description field; input and label for description stay as-is
- **Controller**: Extend `resourceSaveSchema` to include the new `capabilities` field; extend CRUD handlers to read/write it
- **Mastra**: Add a new `customerAgent` with a `searchResourcesByCapability` tool; register alongside `supportAgent` in the Mastra orchestrator
- **Routes**: Add `/chat` route for customer-facing chat; new controller in `app/actions/chat/`
- **Auth**: Customer chat must be accessible to authenticated non-admin users (currently the support agent is admin-only)
