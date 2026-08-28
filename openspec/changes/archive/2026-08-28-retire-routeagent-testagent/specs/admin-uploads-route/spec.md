## REMOVED Requirements

### Requirement: Route-agent navigates to /admin/uploads

**Reason**: The route agent is retired. The `/admin/uploads` route itself stays and is reached directly via the admin sidebar.

**Migration**: Admins navigate to `/admin/uploads` directly through the admin sidebar; no agent-mediated upload navigation protocol exists.

#### Scenario: Route-agent navigates to /admin/uploads for a PDF upload

- **WHEN** the route-agent resolves a user PDF-upload request
- **THEN** it SHALL navigate to `/admin/uploads`
- **AND** SHALL NOT navigate to `/uploads`