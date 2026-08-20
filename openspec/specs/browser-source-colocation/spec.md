# Browser Source Colocation

## Purpose

Define where browser (client) source code lives relative to the server code that renders it, and the `assetServer.allowFiles` contract that selects each tier. Route-owned browser code is colocated in a `public/` subdirectory next to its owning route; shared and global browser components live in `app/ui/`; entry and frame plumbing live in `app/assets/`.

## Requirements

### Requirement: Route-owned browser source lives in `<route>/public/`

Browser source owned by a single route group SHALL be colocated in a `public/` subdirectory within that group's `app/actions/<group>/` directory, matching the upstream demo convention. These files SHALL NOT use a `.browser.` suffix; the `public/` directory is the selector.

#### Scenario: Route-owned browser file is colocated

- **WHEN** a browser component is consumed only by one route group (e.g. `app/actions/client/grid-page.tsx` uses a refresh button)
- **THEN** the browser component SHALL live at `app/actions/<group>/public/<name>.tsx`
- **AND** the owning server module SHALL import it via a relative `./public/<name>.tsx` path

#### Scenario: Route group without a `public/` dir

- **WHEN** a route group has no browser source
- **THEN** it SHALL NOT create an empty `public/` directory

### Requirement: Shared and global browser components stay in `app/ui/`

Browser components consumed by more than one route group, or owned by the global shell (document layout, navigation), SHALL remain in `app/ui/` as `*.browser.tsx` files.

#### Scenario: Cross-route shared component

- **WHEN** a browser component is consumed by multiple route groups (e.g. `confirm-delete` used by client, lists, webhook, and admin routes)
- **THEN** it SHALL remain in `app/ui/` with a `.browser.` suffix
- **AND** it SHALL NOT be moved into a single route's `public/` directory

#### Scenario: Global shell component

- **WHEN** a browser component is rendered by the document shell or main navigation (e.g. `theme-toggle`, `nav-toggle`)
- **THEN** it SHALL remain in `app/ui/` with a `.browser.` suffix

#### Scenario: Shared UI subsystem stays in `app/ui/`

- **WHEN** a browser component depends on a shared helper cluster in `app/ui/` (e.g. the appointment-grid cluster: `schedule-layout`, `appointment-grid-lib/types/styles`, `toast`, `mixins/icon`) that is also consumed by `app/ui` tests and other pages
- **THEN** it SHALL remain in `app/ui/` as a shared subsystem and SHALL NOT be moved into a single route's `public/` directory

### Requirement: Agent stream components group under `app/assets/streams/public/`

Browser components that implement agent event streams SHALL be colocated in `app/assets/streams/public/`, keeping stream plumbing grouped rather than scattering across per-agent route directories.

#### Scenario: Stream component placement

- **WHEN** a browser component implements an agent stream (customer chat, workflow agent, route agent, agent events, support agent, test agent)
- **THEN** it SHALL live in `app/assets/streams/public/`

### Requirement: Entry and frame plumbing stays in `app/assets/`

The client entry, frame resolver, and error card SHALL remain in `app/assets/` and be served as explicit allow-list entries, since they are not route-owned browser source.

#### Scenario: Entry plumbing is explicitly allowed

- **WHEN** a file is the client entry or frame/error plumbing (`entry.tsx`, `frame-response`, `error-card`)
- **THEN** it SHALL remain in `app/assets/`
- **AND** it SHALL be listed explicitly in `assetServer.allowFiles`

### Requirement: Asset allow-list selects by location

`assetServer.allowFiles` SHALL select browser source by location: `app/**/public/**` for route-owned and stream code, `app/ui/**` for shared/global browser components and the shared `ui/` helper modules they depend on, and explicit entries for `app/assets/` plumbing. The allow-list SHALL NOT rely on a single `app/**/*.browser.*` glob for route-owned code, and SHALL NOT narrow `app/ui/**` to only `*.browser.*` files (shared helpers such as `theme`, `auto-grow-textarea` are not suffixed).

#### Scenario: Route-owned code is served

- **WHEN** a browser file lives under `app/**/public/**`
- **THEN** it SHALL be served by the asset server

#### Scenario: Shared ui helpers are served

- **WHEN** a moved browser component imports a shared `app/ui/` helper module (e.g. `theme.ts`, `auto-grow-textarea.ts`) that is not `.browser.*` and not in a `public/` dir
- **THEN** that helper SHALL still be served by the asset server

#### Scenario: Server source is not served

- **WHEN** a server module (e.g. `app/actions/<group>/controller.tsx`) is requested as an asset
- **THEN** it SHALL NOT be served (404)

### Requirement: Moves preserve version control history

Browser source moves SHALL use `git mv` so file history is preserved.

#### Scenario: History-preserving move

- **WHEN** a browser file is relocated to a `public/` directory
- **THEN** the move SHALL use `git mv`
