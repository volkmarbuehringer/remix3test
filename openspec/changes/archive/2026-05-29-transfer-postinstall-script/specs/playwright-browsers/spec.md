## ADDED Requirements

### Requirement: Automatic Playwright browser installation on package install

The system SHALL automatically install Playwright browsers (chromium, firefox --only-shell) after `pnpm install` completes, unless running in a CI environment.

#### Scenario: Successful fresh installation
- **WHEN** `pnpm install` runs and Playwright browsers are not yet installed
- **THEN** the postinstall script SHALL install chromium and firefox browsers using `playwright install --only-shell`
- **THEN** the script SHALL create `INSTALLATION_COMPLETE` marker files for each browser

#### Scenario: Browsers already installed
- **WHEN** `pnpm install` runs and Playwright browsers are already installed (detected by `INSTALLATION_COMPLETE` files)
- **THEN** the script SHALL skip the installation and print a confirmation message

#### Scenario: CI environment
- **WHEN** `pnpm install` runs and the `CI` environment variable is set
- **THEN** the postinstall script SHALL skip browser installation entirely

### Requirement: Installation failure handling

The system SHALL handle Playwright browser installation failures gracefully with retry logic and cleanup.

#### Scenario: First attempt fails
- **WHEN** the first Playwright browser installation attempt fails
- **THEN** the script SHALL clean up any partially installed browser files
- **THEN** the script SHALL retry the installation once

#### Scenario: Retry also fails
- **WHEN** the retry attempt also fails
- **THEN** the script SHALL print an error message with instructions for manual installation
- **THEN** the script SHALL exit with a non-zero exit code

#### Scenario: Installation times out
- **WHEN** Playwright installation takes longer than 5 minutes
- **THEN** the script SHALL kill the installation process tree
- **THEN** the script SHALL exit with a timeout error message

### Requirement: Signal handling during installation

The system SHALL clean up child processes when the parent process receives termination signals.

#### Scenario: SIGINT during installation
- **WHEN** the user presses Ctrl+C during Playwright browser installation
- **THEN** the script SHALL kill the Playwright child process tree
- **THEN** the script SHALL exit

#### Scenario: SIGTERM during installation
- **WHEN** the process receives SIGTERM during Playwright browser installation
- **THEN** the script SHALL kill the Playwright child process tree
- **THEN** the script SHALL exit
