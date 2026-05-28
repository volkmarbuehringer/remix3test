## ADDED Requirements

### Requirement: Client entry handles 401 from frame fetches

The `resolveFrameResponse` function in `app/assets/entry.tsx` SHALL detect HTTP 401 responses from frame fetches and redirect the browser to the login page.

#### Scenario: Frame fetch returns 401 redirects to login
- **WHEN** `resolveFrameResponse` receives a fetch response with status 401
- **THEN** the function SHALL call `window.location.assign(routes.auth.login.index.href())`
- **THEN** the function SHALL return a Promise that never resolves (to prevent rendering stale content)

### Requirement: Client entry shows error card on non-ok frame responses

The `resolveFrameResponse` function SHALL render an error card component when a frame fetch returns a non-ok, non-401 response (e.g., 500, 403).

#### Scenario: Frame fetch returns 500 shows error card
- **WHEN** `resolveFrameResponse` receives a fetch response with status 500
- **THEN** the function SHALL return an error card with an "Unexpected Error" heading
- **THEN** the error card SHALL include a message "An unexpected error occurred. Please reload the page to try again."
- **THEN** the error card SHALL include a reload link using `rmx-document` that points to the current page URL

### Requirement: Client entry handles fatal runtime errors

The `app.addEventListener('error', ...)` handler in `entry.tsx` SHALL gracefully handle unhandled runtime errors by disposing the app, fading out the body, and rendering an error card with the error message and a reload button.

#### Scenario: Unhandled error shows fatal error card
- **WHEN** an unhandled error event fires on the app
- **THEN** the handler SHALL call `app.dispose()`
- **THEN** the handler SHALL animate a fade-out of the current body content using a spring animation
- **THEN** the handler SHALL render an error card in the document body showing the error message
- **THEN** the error card SHALL include a "Reload the page" button that calls `window.location.reload()`
