## ADDED Requirements

### Requirement: lookup_user tool
The `lookup_user` tool SHALL look up a user by numeric ID or email address. It SHALL return the user's id, email, name, role, email verification status, and creation date.

#### Scenario: Lookup by numeric ID
- **WHEN** the tool receives `query: "42"` (a numeric string)
- **THEN** the tool SHALL query the `users` table by `id = 42` and return the matching user record

#### Scenario: Lookup by email
- **WHEN** the tool receives `query: "user@example.com"`
- **THEN** the tool SHALL query the `users` table by `email` and return the matching user record

#### Scenario: No match
- **WHEN** the tool receives a query that matches no user
- **THEN** the tool SHALL return `{ found: false, message: "No user found matching that query" }`

### Requirement: list_recent_appointments tool
The `list_recent_appointments` tool SHALL list recent appointments, optionally filtered by user ID. It SHALL return appointment id, title, date, time range, and user name.

#### Scenario: List recent appointments
- **WHEN** the tool receives `{ limit: 10 }`
- **THEN** the tool SHALL return the 10 most recent appointments with user names

#### Scenario: Filter by user
- **WHEN** the tool receives `{ userId: 5, limit: 5 }`
- **THEN** the tool SHALL return the 5 most recent appointments for user ID 5

#### Scenario: No appointments found
- **WHEN** the tool receives a userId with no appointments
- **THEN** the tool SHALL return `{ count: 0, appointments: [] }`

### Requirement: count_users tool
The `count_users` tool SHALL count users, optionally filtered by role. It SHALL return total count and breakdown by role.

#### Scenario: Count all users
- **WHEN** the tool receives `{}`
- **THEN** the tool SHALL return `{ total: N, byRole: { "admin": X, "customer": Y } }`

#### Scenario: Count by role
- **WHEN** the tool receives `{ role: "admin" }`
- **THEN** the tool SHALL return `{ total: N, byRole: { "admin": N } }` where N is the count of admin users
