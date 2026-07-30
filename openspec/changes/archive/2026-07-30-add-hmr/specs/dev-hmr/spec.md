## Purpose

Provides hot module replacement for the development server so component changes update in-browser without full page reloads or process restarts.

## ADDED Requirements

### Requirement: Process supervision

The development server SHALL run as a child process supervised by `node-hmr`. The supervisor SHALL detect file changes and either hot-update the module in-place or restart the child process. During restarts, the supervisor SHALL buffer incoming requests via a fetch proxy until the child signals readiness.

#### Scenario: Supervisor starts child
- **WHEN** the developer runs `node dev.ts`
- **THEN** the supervisor spawns a child Node process running `server.ts`
- **AND** the child process is configured with `--import remix/ui-hmr/node` for server-side component transforms

#### Scenario: Supervisor restarts on non-HMR change
- **WHEN** a file without `import.meta.hot.accept()` changes
- **THEN** the supervisor restarts the child process
- **AND** the fetch proxy delays incoming requests until the child signals readiness via `emitServerReady()`

### Requirement: Server component HMR

Server-rendered UI component modules SHALL be transformed by `remix/ui-hmr/node` to support `import.meta.hot.accept()`. When a server component implementation changes, the new implementation SHALL be swapped in without restarting the process. Setup-scope changes (new imports, hooks) SHALL mark the component stale for a targeted remount.

#### Scenario: Hot update server component
- **WHEN** a server component file changes and only its implementation changed (not its setup scope)
- **THEN** the new component implementation replaces the old one in the running server
- **AND** in-flight requests continue on the old implementation

#### Scenario: Stale server component remount
- **WHEN** a server component's setup scope (imports, hook usage) changes
- **THEN** the component is marked stale
- **AND** the reconciler unmounts and remounts only that component on the next render

### Requirement: Browser component HMR

Browser UI component modules SHALL be served with HMR transforms by the asset server. The asset server SHALL report watched files to the browser HMR channel. When a browser component changes, the updated module SHALL be pushed to connected browser clients via the EventSource channel, and the browser runtime SHALL swap the implementation in-place without a full page reload.

#### Scenario: Hot update browser component
- **WHEN** a browser component file changes
- **THEN** the asset server recompiles the module with HMR transforms
- **AND** pushes the updated module to browser clients via the HMR EventSource channel
- **AND** the browser runtime swaps the component implementation

#### Scenario: Asset server HMR integration
- **WHEN** the asset server is configured with `hmr` option pointing to a `createBrowserHmrChannel()`
- **THEN** the asset server reports watched files to the browser HMR channel
- **AND** pushes HMR events to connected browser clients

### Requirement: Fetch proxy for zero-downtime restarts

During child process restarts, the fetch proxy SHALL forward requests to the child on the internal port. If the child is not ready, the proxy SHALL retry `GET` and `HEAD` requests until the child responds or the request times out. The proxy SHALL pass `X-Forwarded-*` headers so the child sees the original client address.

#### Scenario: Request during restart
- **WHEN** a GET request arrives while the child process is restarting
- **THEN** the proxy retries the request (with backoff) until the child becomes available
- **AND** returns the child's response to the client

#### Scenario: Request forwarded with client IP
- **WHEN** a request is proxied to the child
- **THEN** the proxy sets `X-Forwarded-For`, `X-Forwarded-Proto`, and `X-Forwarded-Host` headers
