# admin-uploads-route Specification

## Purpose

Defines the external contract for the uploads page after it is relocated into the admin route tree: served at `/admin/uploads` (and `/admin/uploads/:id/download`), accessible to any authenticated user, with the old top-level `/uploads` URLs removed.

## Requirements

### Requirement: Uploads page served at /admin/uploads

The system SHALL serve the uploads page at the admin-tree path `/admin/uploads`, accepting both a GET (render the page) and a POST (multipart file upload) at that path. The POST SHALL insert/claim the submitted file and re-render the updated file list; when a multipart POST is attempted without a usable uploaded file, the controller SHALL surface an upload-failure message in the rendered page.

#### Scenario: Authenticated user GETs the uploads page

- **WHEN** an authenticated user makes a GET request to `/admin/uploads`
- **THEN** the response SHALL have status 200
- **AND** SHALL render the upload form and the list of files visible to that user

#### Scenario: Authenticated user uploads a file

- **WHEN** an authenticated user submits a multipart POST to `/admin/uploads` with a valid file
- **THEN** the file SHALL be claimed/inserted for that user
- **AND** the response SHALL re-render the uploads page listing the newly uploaded file

#### Scenario: Multipart POST without a usable file surfaces an error

- **WHEN** an authenticated user submits a multipart POST to `/admin/uploads` and no uploaded id is produced
- **THEN** the re-rendered page SHALL display an upload-failure message

### Requirement: Uploads access is authenticated but not admin-gated

The system SHALL gate `/admin/uploads` with authentication but NOT with an admin role. Any authenticated user may reach the page; admin users see all uploaded files, and non-admin users see (and may download) only files they uploaded.

#### Scenario: Non-admin user sees only their own uploads

- **WHEN** a non-admin authenticated user loads `/admin/uploads`
- **THEN** the list SHALL contain only the files that user uploaded

#### Scenario: Admin user sees all uploads

- **WHEN** an admin user loads `/admin/uploads`
- **THEN** the list SHALL contain all files across users

#### Scenario: Unauthenticated user is redirected from /admin/uploads

- **WHEN** an unauthenticated user requests `/admin/uploads`
- **THEN** the system SHALL redirect to the login page

### Requirement: Download endpoint at /admin/uploads/:id/download

The system SHALL serve file downloads at the admin-tree path `/admin/uploads/:id/download`, honoring ownership: admin users may download any file, and non-admin users may download only files they uploaded.

#### Scenario: Owner downloads an upload

- **WHEN** a user who owns an upload GETs `/admin/uploads/:id/download`
- **THEN** the response SHALL include the file with `Content-Disposition: attachment`

#### Scenario: Non-owner cannot download

- **WHEN** a non-admin user GETs `/admin/uploads/:id/download` for a file they do not own
- **THEN** the response SHALL have status 404

#### Scenario: Invalid download id

- **WHEN** a client GETs `/admin/uploads/:id/download` with a missing or non-numeric id
- **THEN** the response SHALL have status 400

### Requirement: Old /uploads paths are removed

The system SHALL NOT serve the legacy top-level uploads paths. GET `/uploads` and GET `/uploads/:id/download` SHALL no longer resolve (no redirect or alias).

#### Scenario: Legacy page path returns 404

- **WHEN** a client requests GET `/uploads`
- **THEN** the response SHALL have status 404

#### Scenario: Legacy download path returns 404

- **WHEN** a client requests GET `/uploads/:id/download`
- **THEN** the response SHALL have status 404

### Requirement: Uploads rendered in the admin frame with a sidebar entry

The uploads page SHALL render within the admin content frame (the same admin sidebar layout used by `/admin/users`), and the admin sidebar SHALL include an "Uploads" navigation item whose href is `/admin/uploads`.

#### Scenario: Admin sidebar links Uploads to /admin/uploads

- **WHEN** an admin user loads an admin page
- **THEN** the admin sidebar SHALL contain a link labeled "Uploads" with href `/admin/uploads`

#### Scenario: Uploads page renders inside the admin frame

- **WHEN** a user loads `/admin/uploads`
- **THEN** the page SHALL render within the admin content frame rather than the top-level app layout
