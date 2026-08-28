## MODIFIED Requirements

### Requirement: Frame-aware reload utility

A shared utility function SHALL be available that client entries call instead of bare `window.location.reload()`. The utility SHALL detect whether the code is executing inside an agent frame container and reload only that frame, falling back to top-level reload otherwise.

#### Scenario: safeReload inside support agent frame

- **WHEN** `safeReload(handle)` is called from within the support agent page
- **THEN** the function SHALL detect `#support-agent-frame-container`
- **AND** reload the frame whose name matches `data-active-frame` using `handle.frames.get(name).reload()`

#### Scenario: safeReload outside any agent frame

- **WHEN** `safeReload(handle)` is called outside any agent frame container
- **THEN** the function SHALL fall back to `window.location.reload()`