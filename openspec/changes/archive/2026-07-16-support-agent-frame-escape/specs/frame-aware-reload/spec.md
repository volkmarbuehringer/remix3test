## ADDED Requirements

### Requirement: Frame-aware reload utility

A shared utility function SHALL be available that client entries call instead of bare `window.location.reload()`. The utility SHALL detect whether the code is executing inside an agent frame container and reload only that frame, falling back to top-level reload otherwise.

#### Scenario: safeReload inside support agent frame

- **WHEN** `safeReload(handle)` is called from within the support agent page
- **THEN** the function SHALL detect `#support-agent-frame-container`
- **AND** reload the frame whose name matches `data-active-frame` using `handle.frames.get(name).reload()`

#### Scenario: safeReload outside any agent frame

- **WHEN** `safeReload(handle)` is called outside any agent frame container
- **THEN** the function SHALL fall back to `window.location.reload()`

#### Scenario: safeReload inside route agent frame

- **WHEN** `safeReload(handle)` is called inside a route agent page
- **THEN** the function SHALL detect `#route-agent-frame-container`
- **AND** reload the active frame

### Requirement: Frame-aware navigation utility

A shared utility function SHALL be available that client entries call instead of `window.location.href = url`. It SHALL navigate the active frame when inside an agent frame, falling back to top-level navigation otherwise.

#### Scenario: safeNavigate inside agent frame

- **WHEN** `safeNavigate(href, handle)` is called from within an agent frame container
- **THEN** the active frame SHALL be navigated to `href` using `handle.frames.get(name).src = href; ...reload()`

#### Scenario: safeNavigate outside any agent frame

- **WHEN** `safeNavigate(href, handle)` is called outside any agent frame
- **THEN** `window.location.href = href` SHALL be called

### Requirement: Client entries use frame-aware utilities

Client entries that call `window.location.reload()` or `window.location.href =` directly SHALL be updated to import and use `safeReload`/`safeNavigate`.

#### Scenario: nutzer-table-interactive uses safeReload

- **WHEN** a context menu action succeeds (lock, unlock, activate, deactivate, reset-password, delete)
- **THEN** the handler SHALL call `safeReload(handle)` instead of `window.location.reload()`

#### Scenario: nutzer-table-interactive uses safeNavigate

- **WHEN** the edit context menu action is triggered
- **THEN** the handler SHALL call `safeNavigate(href, handle)` instead of `window.location.href = href`
