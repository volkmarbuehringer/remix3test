## ADDED Requirements

### Requirement: Asset entry middleware resolves script URLs at request time

The middleware SHALL resolve the main entry script URL and its preloads using the asset server, storing them in request context for downstream use by the render middleware and document component.

#### Scenario: Middleware sets script HREF in context
- **WHEN** the asset entry middleware runs
- **THEN** it SHALL call `assetServer.getHref(entryPath)` and store the result in context

#### Scenario: Middleware resolves preloads
- **WHEN** the asset entry middleware runs
- **THEN** it SHALL call `assetServer.getPreloads(entryPath)` and store the results in context
- **THEN** preload failures SHALL be caught and result in an empty array (non-fatal)

### Requirement: Document component reads from context

The `Document` component in `app/ui/document.tsx` SHALL read the entry script HREF from context when the asset entry middleware is present, falling back to the current hardcoded approach otherwise.

#### Scenario: Middleware present — uses context script HREF
- **WHEN** the asset entry middleware has set `scriptSrc` in context
- **THEN** `Document` SHALL use that value for the `<script type="module">` tag

#### Scenario: Middleware absent — uses hardcoded fallback
- **WHEN** the asset entry middleware is not installed
- **THEN** `Document` SHALL fall back to the current direct URL construction

### Requirement: Asset entry accepts configurable paths

The `loadAssetEntry()` factory function SHALL accept optional paths for the script entry and stylesheet entry, with sensible defaults pointing at newapp's standard entry points.

#### Scenario: Default paths used
- **WHEN** `loadAssetEntry()` is called without arguments
- **THEN** the default entry path SHALL be `app/assets/entry.tsx`

#### Scenario: Custom paths accepted
- **WHEN** `loadAssetEntry(scriptEntry, stylesheetEntry)` is called
- **THEN** the provided paths SHALL be used instead of defaults
