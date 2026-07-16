## ADDED Requirements

## MODIFIED Requirements

### Requirement: Test-agent rendering

The test-agent page SHALL render correctly both as a standalone page and as an admin frame.

#### Scenario: Frame renders without outer Layout

- **WHEN** the test-agent page is requested with `X-Remix-Target: adminContent`
- **THEN** the response SHALL NOT include the outer `<Layout>` component that contains `MainNav`

#### Scenario: Direct access renders with admin sidebar

- **WHEN** the test-agent page is accessed directly (no frame header)
- **THEN** the response SHALL include `<Layout>` and `<AdminLayout>` wrapping the page content

#### Scenario: Admin sidebar Test-Agent link works

- **WHEN** a user clicks "Test-Agent" in the admin sidebar
- **THEN** only one navbar SHALL be visible and the page content SHALL load

## REMOVED Requirements
