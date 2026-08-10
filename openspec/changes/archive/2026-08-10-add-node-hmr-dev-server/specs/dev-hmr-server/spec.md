## Purpose

Adds an opt-in HMR development server for the Remix 3 app: a proxy/runner that keeps the app server alive with per-module updates and state-preserving reconciles, instead of the full-reload `node --watch` loop.

## ADDED Requirements

### Requirement: HMR dev runner script

The package SHALL expose an `hmr` npm script that starts the HMR dev server; the existing `dev` script SHALL remain unchanged.

#### Scenario: HMR script available

- **WHEN** a developer runs `npm run hmr`
- **THEN** a development server SHALL start on the proxy port
- **AND** the app's real HTTP server SHALL run on a separate port distinct from the proxy port

#### Scenario: Dev script unchanged

- **WHEN** a developer runs `npm run dev`
- **THEN** the app SHALL start directly without the HMR proxy, as before

### Requirement: Proxy forwards only after app readiness

The HMR proxy SHALL buffer in-flight requests until the app server signals it is ready, then forward them to the app; the app's database initialization and required-environment validation SHALL run before the app signals readiness.

#### Scenario: Request before readiness

- **WHEN** a request reaches the proxy before the app server sends its ready signal
- **THEN** the proxy SHALL hold the request and forward it once the app becomes ready

#### Scenario: Request after readiness

- **WHEN** the app server signals readiness
- **THEN** subsequent requests SHALL be forwarded to the app server
- **AND** the app's existing request handling (database use, env validation, client IP header) SHALL behave as in non-HMR runs

### Requirement: Server-ready signal under HMR

When the app process runs with HMR enabled, the app server SHALL emit a readiness signal to the runner after it starts listening.

#### Scenario: Ready signal in HMR mode

- **WHEN** the app process is started with HMR enabled and its HTTP server begins listening on the assigned port
- **THEN** the app SHALL emit the server-ready signal
- **AND** it SHALL do so without changing production behavior when HMR is not enabled

### Requirement: Development asset pipeline HMR mode

The asset pipeline SHALL enable hot module reloading only during development with HMR enabled: watching, the browser HMR channel, and the injected UI HMR loader script.

#### Scenario: HMR development mode

- **WHEN** `NODE_ENV` is `development` and HMR is enabled
- **THEN** the asset server SHALL watch the source tree for changes
- **AND** SHALL expose a browser HMR event channel
- **AND** SHALL inject the UI HMR loader script into served modules

#### Scenario: Non-HMR development mode

- **WHEN** `NODE_ENV` is `development` and HMR is not enabled
- **THEN** the asset pipeline SHALL keep its current non-HMR behavior

#### Scenario: Production mode

- **WHEN** `NODE_ENV` is `production`
- **THEN** the asset pipeline SHALL NOT enable watching or the HMR channel
- **AND** the `import.meta.hot` handler SHALL be inert

### Requirement: Client-side server update reload

The browser entry SHALL handle a server-update notification from the HMR runtime by reconciling mounted UI and reloading the top frame, preserving client component state where possible.

#### Scenario: Server update event

- **WHEN** the HMR runtime reports a server-side update
- **THEN** the entry SHALL wait for frame readiness
- **AND** SHALL reload the top frame so updated server markup is rendered
- **AND** SHALL log a console error if the reload fails

### Requirement: Configurable ports

The HMR proxy port, HMR event channel port, and app server port SHALL be configurable via environment variables, with sensible defaults.

#### Scenario: Default ports

- **WHEN** no port environment variables are set
- **THEN** the proxy SHALL listen on the proxy port default (44100)
- **AND** the app server SHALL run on a distinct default app port

#### Scenario: Custom ports

- **WHEN** the port and app-port environment variables are set
- **THEN** the HMR runner SHALL use the supplied values for the proxy port and the spawned app process