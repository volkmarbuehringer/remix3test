## ADDED Requirements

### Requirement: `app/lib/` does not exist
No file or directory SHALL exist at `app/lib/` after this change. Every former `app/lib/*` resident SHALL have a new home in `app/ui/theme/`, `app/data/`, or `app/utils/`.

#### Scenario: No lib directory on disk
- **WHEN** a maintainer lists `app/` looking for `lib`
- **THEN** no `app/lib/` directory exists

#### Scenario: Theme primitives live under ui/theme
- **WHEN** a maintainer needs `theme.ts`, `button.ts`, `glyph.ts`, or `separator.ts` (or their subdirectories)
- **THEN** they are located under `app/ui/theme/**`

#### Scenario: Domain modules live under data
- **WHEN** a maintainer needs `lists-api.ts` or `chatlog.ts`
- **THEN** they are located (renamed) at `app/data/lists.ts` and `app/data/chatlog.ts`

#### Scenario: Pure utilities live under utils
- **WHEN** a maintainer needs `request-ip.ts`, `sensitive-headers.ts`, `math.ts`, `scroll-lock.ts`, `sse.ts`, `sse-events.ts`, `messages-sse.ts`, `appointments-sse.ts`, or `appointtype-drag.ts`
- **THEN** they are located under `app/utils/**`

#### Scenario: Co-located tests move alongside their sources
- **WHEN** a maintainer looks for the test that previously lived at `app/lib/chatlog.test.ts`, `app/lib/lists-api.test.ts`, or `app/lib/sse.test.ts`
- **THEN** the test is now located at `app/data/chatlog.test.ts`, `app/data/lists.test.ts`, or `app/utils/sse.test.ts` respectively

### Requirement: Asset allow list excludes `app/lib/**`
`app/assets.ts` SHALL NOT list `app/lib/**` in its bundler allow list.

#### Scenario: Allow list trimmed
- **WHEN** a maintainer reads `app/assets.ts:12` (the `allow` array)
- **THEN** the array contains `app/assets/**`, `app/routes.ts`, `app/ui/**`, `app/utils/**`, and `node_modules/**`
- **AND** does not contain `app/lib/**`

#### Scenario: Pipeline still bundles relocated files
- **WHEN** the asset pipeline runs against a build that includes relocated files under `app/ui/theme/**` and `app/utils/**`
- **THEN** those files bundle successfully because `app/ui/**` and `app/utils/**` remain allow-listed

### Requirement: No imports reference `app/lib/`
No file in `app/**` SHALL import from a path beginning with `app/lib/` after this change.

#### Scenario: No app/lib import paths remain
- **WHEN** a maintainer greps `app/**` for the import path segment `app/lib/`
- **THEN** zero matches are returned

### Requirement: UI does not import types from controllers
Files under `app/ui/**` SHALL NOT import any value or type from `app/actions/**` controller files. Shape types used by UI SHALL be imported from `app/data/**` or `app/types/**`.

#### Scenario: No UI controller imports remain
- **WHEN** a maintainer greps `app/ui/**` for `from '.*actions/.*controller'`
- **THEN** zero matches are returned

#### Scenario: Each UI type has a data home
- **WHEN** a maintainer needs `OfferingRow`, `OfferingsResourceOption`, `AppointmentRow`, `AppointmentResourceOption`, `AppointmentUserOption`, `OfferingConfigRow`, `OfferingConfigResourceOption`, `WebhookRequestRow`, `Report1Row`, or `DayWithSlots` / `ResourceOption`
- **THEN** the type is exported from a module under `app/data/**`
- **AND** the controller and UI both import it from there