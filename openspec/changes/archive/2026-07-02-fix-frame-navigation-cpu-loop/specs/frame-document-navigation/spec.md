## ADDED Requirements

### Requirement: Cross-section navigation uses document-level reload

Links that navigate between Frame-relay-based route sections (e.g., admin section to lists section, or lists section to admin section) SHALL include the `rmx-document` attribute, causing Remix 3 to perform a real document-level page navigation instead of a frame-based reload that triggers a CPU-hogging frame-resolution loop.

#### Scenario: Description link on /admin/lists navigates to /lists

- **WHEN** an admin user clicks the description link on the `/admin/lists` page that points to `/lists?load=<id>`
- **THEN** the browser performs a full document-level page navigation to `/lists?load=<id>` without entering a frame-resolution loop

#### Scenario: MainNav "Admin" link on /lists performs document navigation

- **WHEN** a user on the `/lists` page clicks the "Admin" link in the main navigation
- **THEN** the browser performs a full document-level page navigation to `/admin` without entering a frame-resolution loop

#### Scenario: MainNav same-section link uses frame navigation

- **WHEN** a user on the `/admin` page clicks an admin-related link in the main navigation that stays within the admin section
- **THEN** the link does NOT include `rmx-document` and Remix handles it as a frame-based navigation where appropriate

#### Scenario: Browser remains responsive after cross-section navigation

- **WHEN** a user navigates between Frame-relay-based sections using any supported navigation link
- **THEN** the browser tab remains responsive with normal CPU usage (does not peg at 100% CPU)
