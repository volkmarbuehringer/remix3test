## REMOVED Requirements

### Requirement: Resolve user before appointment navigation

**Reason**: The workflow-agent page is merged into the agent-events pipeline, whose resolve handler already resolves target users and resources with the same ambiguity error behavior before navigating.

**Migration**: Use `/admin/agent-events` for appointment queries. Ambiguous target matches produce an error message and no navigation; a unique match navigates to `/verwaltung/appointments?filter=<resolved_email>`.