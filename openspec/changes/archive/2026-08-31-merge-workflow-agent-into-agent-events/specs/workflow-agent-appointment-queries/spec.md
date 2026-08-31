## REMOVED Requirements

### Requirement: Detect appointment questions

**Reason**: The workflow-agent page is merged into the agent-events pipeline; appointment-check detection now lives in the agent-events classifier (`show-appointments` intent).

**Migration**: Use `/admin/agent-events` for appointment queries. The merged surface preserves the period and status behaviors in `agent-events-intent-classification`.

### Requirement: Map date references to period values

**Reason**: The workflow-agent page is retired; date-period mapping is preserved by the agent-events `show-appointments` intent as the `period` query parameter.

**Migration**: Use `/admin/agent-events`; the `period` parameter (`today|this-week|this-month|next-week|next-month`) is applied on the appointments navigation.

### Requirement: Map status references to status values

**Reason**: The workflow-agent page is retired; status mapping is preserved by the agent-events `show-appointments` intent as the `status` query parameter.

**Migration**: Use `/admin/agent-events`; the `status` parameter (`pending|expired`) is applied on the appointments navigation.

### Requirement: Combine filter, period, and status

**Reason**: The workflow-agent page is retired; filter/period/status combination is preserved by the agent-events `show-appointments` intent.

**Migration**: Use `/admin/agent-events`; a resolved user filter, period, and status are combined on the `/verwaltung/appointments` navigation.